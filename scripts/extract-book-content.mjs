import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const vocab = JSON.parse(fs.readFileSync(path.join(root, "public/vocab.json"), "utf8"));
const themesPayload = JSON.parse(fs.readFileSync(path.join(root, "public/data/list-themes.v1.json"), "utf8"));
const layoutsDirectory = path.join(root, "tmp/book-layout");
const destination = path.join(root, "tmp/book-content.v1.json");
const allWords = vocab.flatMap((list) => list.words.map((word) => ({ ...word, listId: list.number, chapter: list.chapter })));
const byNormalizedWord = new Map();

const normalize = (value) => value
  .normalize("NFKD")
  .replace(/[’‘`]/g, "'")
  .replace(/[^a-z0-9' -]/gi, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();
for (const word of allWords) {
  const key = normalize(word.word);
  if (!byNormalizedWord.has(key)) byNormalizedWord.set(key, []);
  byNormalizedWord.get(key).push(word);
}
const headwords = [...byNormalizedWord.keys()].sort((a, b) => b.length - a.length);
const isCjk = (value) => /[\u3400-\u9fff]/u.test(value);
const joinTokens = (tokens) => {
  let text = "";
  for (const token of tokens) {
    const value = token.text.trim();
    if (!value) continue;
    const previous = text.at(-1) ?? "";
    const noSpace = !text || (isCjk(previous) && isCjk(value[0])) || /^[,.;:!?，。；：！？)）\]】]/u.test(value) || /[(（\[【]$/u.test(previous);
    text += `${noSpace ? "" : " "}${value}`;
  }
  return text.replace(/\s+/g, " ").trim();
};

const linesForPage = (payload) => {
  const sourceLines = payload.blocks.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines));
  const tokens = sourceLines.flatMap((line) => line.words);
  const width = Math.max(...tokens.map((word) => word.bbox.x1), 1);
  const middle = width / 2;
  const lines = [];
  for (const column of [0, 1]) {
    const columnTokens = tokens
      .filter((word) => ((word.bbox.x0 + word.bbox.x1) / 2 < middle ? 0 : 1) === column)
      .map((word) => ({ ...word, centerY: (word.bbox.y0 + word.bbox.y1) / 2 }))
      .sort((a, b) => a.centerY - b.centerY || a.bbox.x0 - b.bbox.x0);
    const rows = [];
    for (const token of columnTokens) {
      let row = rows.at(-1);
      if (!row || Math.abs(token.centerY - row.centerY) > 11) {
        row = { centerY: token.centerY, tokens: [] };
        rows.push(row);
      }
      row.tokens.push(token);
      row.centerY = row.tokens.reduce((sum, item) => sum + item.centerY, 0) / row.tokens.length;
    }
    for (const row of rows) {
      row.tokens.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      lines.push({
        column,
        y: row.centerY,
        text: joinTokens(row.tokens),
        confidence: row.tokens.reduce((sum, token) => sum + token.confidence, 0) / row.tokens.length,
      });
    }
  }
  return lines.sort((a, b) => a.column - b.column || a.y - b.y);
};

const headwordCandidate = (line) => {
  if (!line.includes("/")) return null;
  const candidate = normalize(line.slice(0, line.indexOf("/")));
  if (!candidate || candidate.length > 38 || candidate.split(" ").length > 4 || !/[a-z]{2}/.test(candidate)) return null;
  return candidate;
};
const editDistance = (left, right) => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
};
const similarity = (left, right) => 1 - editDistance(left, right) / Math.max(left.length, right.length, 1);

const detected = [];
const pageLines = new Map();
const files = fs.existsSync(layoutsDirectory)
  ? fs.readdirSync(layoutsDirectory).filter((file) => /^page-\d+\.json$/.test(file)).sort()
  : [];
for (const file of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(layoutsDirectory, file), "utf8"));
  const page = payload.page;
  const lines = linesForPage(payload);
  pageLines.set(page, lines);
  const heads = lines.map((line, index) => ({ ...line, index, key: headwordCandidate(line.text) })).filter((line) => line.key);
  for (const head of heads) {
    const next = heads.find((candidate) => candidate.column === head.column && candidate.y > head.y);
    const block = lines.filter((line) => line.column === head.column && line.y > head.y && (!next || line.y < next.y));
    detected.push({ page, key: head.key, head: head.text, confidence: head.confidence, block });
  }
}

const anchors = [];
let scanCursor = 0;
for (let detectedIndex = 0; detectedIndex < detected.length; detectedIndex += 1) {
  const entry = detected[detectedIndex];
  let vocabularyIndex = -1;
  for (let index = scanCursor; index < Math.min(allWords.length, scanCursor + 180); index += 1) {
    if (normalize(allWords[index].word) === entry.key) { vocabularyIndex = index; break; }
  }
  if (vocabularyIndex >= 0) {
    anchors.push({ detectedIndex, vocabularyIndex });
    scanCursor = vocabularyIndex + 1;
  }
}

const assignments = new Map(anchors.map((anchor) => [anchor.detectedIndex, { vocabularyIndex: anchor.vocabularyIndex, score: 1 }]));
const boundaries = [{ detectedIndex: -1, vocabularyIndex: -1 }, ...anchors, { detectedIndex: detected.length, vocabularyIndex: allWords.length }];
for (let boundaryIndex = 0; boundaryIndex < boundaries.length - 1; boundaryIndex += 1) {
  const left = boundaries[boundaryIndex];
  const right = boundaries[boundaryIndex + 1];
  const detectedGap = right.detectedIndex - left.detectedIndex - 1;
  const vocabularyGap = right.vocabularyIndex - left.vocabularyIndex - 1;
  if (detectedGap === vocabularyGap && detectedGap > 0) {
    for (let offset = 1; offset <= detectedGap; offset += 1) {
      const detectedIndex = left.detectedIndex + offset;
      const vocabularyIndex = left.vocabularyIndex + offset;
      assignments.set(detectedIndex, { vocabularyIndex, score: similarity(detected[detectedIndex].key, normalize(allWords[vocabularyIndex].word)) });
    }
  }
}

const usedVocabulary = new Set([...assignments.values()].map((assignment) => assignment.vocabularyIndex));
for (let detectedIndex = 0; detectedIndex < detected.length; detectedIndex += 1) {
  if (assignments.has(detectedIndex)) continue;
  const entry = detected[detectedIndex];
  let best = null;
  for (let vocabularyIndex = 0; vocabularyIndex < allWords.length; vocabularyIndex += 1) {
    if (usedVocabulary.has(vocabularyIndex)) continue;
    const expected = normalize(allWords[vocabularyIndex].word);
    if (Math.abs(expected.length - entry.key.length) > 4 || expected[0] !== entry.key[0]) continue;
    const score = similarity(entry.key, expected);
    if (!best || score > best.score) best = { vocabularyIndex, score };
    if (score === 1) break;
  }
  if (best && best.score >= 0.86) {
    assignments.set(detectedIndex, best);
    usedVocabulary.add(best.vocabularyIndex);
  }
}

const assigned = [...assignments]
  .sort((a, b) => a[0] - b[0])
  .map(([detectedIndex, assignment]) => ({
    entry: detected[detectedIndex],
    word: allWords[assignment.vocabularyIndex],
    matchScore: assignment.score,
  }));

const markerPattern = /^\s*(?:[\[【]\s*([^\]】]{1,5})[\]】]|([例搭记])[\]】])\s*/u;
const splitLanguages = (value) => {
  const match = value.match(/[\u3400-\u9fff]/u);
  if (!match || match.index === undefined) return { en: value.trim(), zh: "" };
  return { en: value.slice(0, match.index).trim(), zh: value.slice(match.index).trim() };
};
const cleanEnglish = (value) => value.replace(/\s+([,.;:!?])/g, "$1").replace(/-\s+/g, "-").replace(/\s+/g, " ").trim();
const cleanChinese = (value) => value.replace(/\s+/g, "").replace(/([，。；：！？])\1+/g, "$1").trim();

function parseBlock(entry, word) {
  const sections = { example: [], collocation: [], memory: [] };
  let active = null;
  for (const sourceLine of entry.block) {
    const fragments = sourceLine.text
      .replace(/([^\n])(?=[\[【][^\]】]{1,5}[\]】])/gu, "$1\n")
      .split("\n")
      .filter(Boolean);
    for (let text of fragments) {
      const marker = text.match(markerPattern) || text.match(/^\s*(\[[^\s]{1,7}|[例搭记][\]】])\s*/u);
      if (marker) {
        const label = marker[1] || marker[2];
        const remainder = text.slice(marker[0].length).trim();
        if (/例/.test(label)) active = "example";
        else if (/搭/.test(label)) active = "collocation";
        else if (/记/.test(label)) active = "memory";
        else if (/^[A-Z]/.test(remainder) && remainder.split(/\s+/).length >= 4) active = "example";
        else if (/^[a-z]/.test(remainder) && remainder.split(/\s+/).length <= 10) active = "collocation";
        else active = null;
        text = text.replace(markerPattern, "");
      } else if (/\+|→|->/u.test(text)) {
        active = "memory";
      } else if (active === "example" && /^(n|v|adj|adv|prep|conj)\.?\s/iu.test(text)) {
        active = null;
      }
      if (!active || !text.trim()) continue;
      sections[active].push(splitLanguages(text));
      if (active === "example") {
        const combined = sections.example.reduce((result, item) => ({ en: `${result.en} ${item.en}`, zh: `${result.zh}${item.zh}` }), { en: "", zh: "" });
        if (/[.!?]\s*$/u.test(combined.en.trim()) && /[。！？]\s*$/u.test(combined.zh.trim())) active = null;
      } else if (active === "memory" && sections.memory.length >= 4) {
        active = null;
      }
    }
  }
  const combine = (items) => ({
    en: cleanEnglish(items.map((item) => item.en).filter(Boolean).join(" ")),
    zh: cleanChinese(items.map((item) => item.zh).filter(Boolean).join("")),
  });
  const example = combine(sections.example);
  const collocationText = sections.collocation.map((item) => combine([item])).filter((item) => item.en);
  const memory = combine(sections.memory);
  return {
    wordId: word.id,
    word: word.word,
    listId: word.listId,
    page: entry.page,
    ocrConfidence: Math.round(entry.confidence * 10) / 10,
    exampleEnglish: example.en,
    exampleChinese: example.zh,
    collocations: collocationText,
    memoryNote: cleanChinese(memory.zh || memory.en),
    rawHead: entry.head,
    rawLines: entry.block.map((line) => line.text),
    reviewStatus: "ocr-extracted-needs-review",
  };
}

const entries = {};
for (const { entry, word, matchScore } of assigned) {
  entries[word.id] = { ...parseBlock(entry, word), headwordMatchScore: Math.round(matchScore * 1000) / 1000 };
}

const visionReferencePath = path.join(root, "tmp/book-reference.v1.json");
const visionReference = fs.existsSync(visionReferencePath) ? JSON.parse(fs.readFileSync(visionReferencePath, "utf8")).entries : {};
const looksLikeExampleMarker = (text) => {
  const marker = text.match(markerPattern) || text.match(/^\s*(\[[^\s]{1,7}|[例搭记][\]】])\s*/u);
  if (!marker) return false;
  const label = marker[1] || marker[2];
  const remainder = text.slice(marker[0].length).trim();
  return /例/.test(label) || (!/搭|记/.test(label) && /^[A-Z]/.test(remainder) && remainder.split(/\s+/).length >= 4);
};
for (const word of allWords) {
  if (entries[word.id]?.exampleEnglish && entries[word.id]?.exampleChinese) continue;
  const page = entries[word.id]?.page ?? visionReference[word.id]?.page;
  if (!page) continue;
  let recovered = null;
  for (const candidatePage of [page - 1, page, page + 1]) {
    const lines = pageLines.get(candidatePage) ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      if (!looksLikeExampleMarker(lines[index].text)) continue;
      const selected = [lines[index]];
      for (let lookahead = index + 1; lookahead < Math.min(lines.length, index + 5); lookahead += 1) {
        if (lines[lookahead].column !== lines[index].column || looksLikeExampleMarker(lines[lookahead].text) || lines[lookahead].text.match(markerPattern)) break;
        selected.push(lines[lookahead]);
      }
      const pieces = selected.map((line, pieceIndex) => {
        if (pieceIndex !== 0) return splitLanguages(line.text);
        const leading = line.text.match(markerPattern) || line.text.match(/^\s*(\[[^\s]{1,7}|[例搭记][\]】])\s*/u);
        return splitLanguages(leading ? line.text.slice(leading[0].length) : line.text);
      });
      const en = cleanEnglish(pieces.map((piece) => piece.en).filter(Boolean).join(" "));
      const zh = cleanChinese(pieces.map((piece) => piece.zh).filter(Boolean).join(""));
      if (normalize(en).includes(normalize(word.word)) && /[.!?]/.test(en)) {
        recovered = { page: candidatePage, en, zh };
        break;
      }
    }
    if (recovered) break;
  }
  if (!recovered) continue;
  if (!entries[word.id]) {
    entries[word.id] = {
      wordId: word.id, word: word.word, listId: word.listId, page: recovered.page,
      ocrConfidence: 0, collocations: [], memoryNote: "", rawHead: "", rawLines: [],
      reviewStatus: "ocr-recovered-needs-review", headwordMatchScore: 0,
    };
  }
  entries[word.id].exampleEnglish ||= recovered.en;
  entries[word.id].exampleChinese ||= recovered.zh;
}

const stats = Object.values(entries).reduce((result, entry) => {
  result.matched += 1;
  if (entry.exampleEnglish) result.examples += 1;
  if (entry.exampleChinese) result.translations += 1;
  if (entry.collocations.length) result.collocations += 1;
  if (entry.memoryNote) result.memory += 1;
  return result;
}, { matched: 0, examples: 0, translations: 0, collocations: 0, memory: 0 });

fs.writeFileSync(destination, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: "《雅思词汇真经》用户提供扫描版",
  pagesProcessed: files.length,
  totalVocabulary: allWords.length,
  stats,
  entries,
}, null, 2)}\n`);
console.log(JSON.stringify({ pages: files.length, total: allWords.length, ...stats, destination }, null, 2));
