import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const vocab = JSON.parse(fs.readFileSync(path.join(root, "public/vocab.json"), "utf8"));
const themes = JSON.parse(fs.readFileSync(path.join(root, "public/data/list-themes.v1.json"), "utf8")).lists;
const extracted = JSON.parse(fs.readFileSync(path.join(root, "tmp/book-content.v1.json"), "utf8")).entries;
const originals = JSON.parse(fs.readFileSync(path.join(root, "public/data/vocab-original-examples.v1.json"), "utf8")).entries;
const demoPayload = JSON.parse(fs.readFileSync(path.join(root, "public/data/vocab-expansions.demo.v1.json"), "utf8"));
const demo = new Map(demoPayload.entries.map((entry) => [entry.wordId, entry]));
const allWords = vocab.flatMap((list) => list.words.map((word, index) => ({ ...word, listId: list.number, listIndex: index, chapter: list.chapter })));
const sourceByWord = new Map();
for (const entry of Object.values(extracted)) {
  if (entry.exampleEnglish && entry.exampleChinese) sourceByWord.set(entry.word.toLowerCase(), entry);
}

const pos = (definition) => {
  const found = [];
  if (/(^|\s)n\s*\./i.test(definition)) found.push("noun");
  if (/(^|\s)v\s*\./i.test(definition)) found.push("verb");
  if (/adj\s*\./i.test(definition)) found.push("adjective");
  if (/adv\s*\./i.test(definition)) found.push("adverb");
  return found.length ? found : ["other"];
};
const coreMeaning = (definition) => definition.replace(/^(?:\([^)]*\)\s*)?(?:n|v|adj|adv|prep|conj)\s*\.\s*/i, "").split(/[；;]/)[0].trim();
const cleanSentence = (value, target) => {
  const text = value.replace(/\s+/g, " ").trim();
  const sentences = text.match(/[^.!?]*[.!?]/g) ?? [text];
  return sentences.find((sentence) => sentence.toLowerCase().includes(target.toLowerCase()))?.trim() || text;
};
const cleanTranslation = (value) => (value.match(/[^。！？]*[。！？]/u)?.[0] || value).replace(/\s+/g, "").trim();
const contextualPhrases = (sentence, target) => {
  const tokens = sentence.replace(/[.,!?;:()“”"']/g, "").split(/\s+/).filter(Boolean);
  const targetTokens = target.toLowerCase().split(/\s+/);
  let index = -1;
  for (let i = 0; i <= tokens.length - targetTokens.length; i += 1) {
    if (tokens.slice(i, i + targetTokens.length).join(" ").toLowerCase() === target.toLowerCase()) { index = i; break; }
  }
  if (index < 0) return [target];
  const phrases = [
    tokens.slice(Math.max(0, index - 2), Math.min(tokens.length, index + targetTokens.length + 2)).join(" "),
    tokens.slice(Math.max(0, index - 1), Math.min(tokens.length, index + targetTokens.length + 3)).join(" "),
  ].filter(Boolean);
  return [...new Set(phrases)];
};

const entries = [];
for (const list of vocab) {
  const theme = themes.find((item) => item.list === list.number);
  for (let index = 0; index < list.words.length; index += 1) {
    const word = list.words[index];
    if (demo.has(word.id)) {
      entries.push(demo.get(word.id));
      continue;
    }
    const exactSource = extracted[word.id];
    const source = (exactSource?.exampleEnglish && exactSource?.exampleChinese)
      ? exactSource
      : (sourceByWord.get(word.word.toLowerCase()) ?? exactSource);
    const original = originals[word.id];
    const exampleEnglish = original?.[0] || cleanSentence(source?.exampleEnglish || "", word.word);
    const exampleChinese = original?.[1] || cleanTranslation(source?.exampleChinese || "");
    if (!exampleEnglish || !exampleChinese) throw new Error(`Missing bilingual example for ${word.id} ${word.word}`);
    const chapterNumber = theme?.chapterNumbers?.[0] ?? Number(list.chapter.match(/\d+/)?.[0] || 0);
    const meaning = coreMeaning(word.definition);
    const neighbours = [index - 2, index - 1, index + 1, index + 2]
      .map((position) => list.words[position])
      .filter(Boolean);
    const sourcedCollocations = (source?.collocations ?? [])
      .filter((item) => item.en && /[a-z]{2}/i.test(item.en) && item.en.split(/\s+/).length <= 9)
      .slice(0, 2)
      .map((item) => ({ text: item.en, translationZh: item.zh || `语境搭配：${meaning}` }));
    const phrases = contextualPhrases(exampleEnglish, word.word);
    const collocations = [...sourcedCollocations];
    for (const phrase of phrases) {
      if (collocations.length >= 2) break;
      if (!collocations.some((item) => item.text.toLowerCase() === phrase.toLowerCase())) {
        collocations.push({ text: phrase, translationZh: `例句语境：${meaning}` });
      }
    }
    while (collocations.length < 2) collocations.push({ text: word.word, translationZh: meaning });
    const sourceMemory = source?.memoryNote?.trim();
    const mnemonic = sourceMemory && sourceMemory.length >= 3
      ? sourceMemory
      : `语义联想：在“${theme?.themeZh || list.chapter}”场景中，把 ${word.word} 与“${meaning}”绑定记忆；先回想主题画面，再说出词义。`;
    const isOriginal = Boolean(original);
    entries.push({
      wordId: word.id,
      chapterId: String(chapterNumber).padStart(2, "0"),
      chapterTitle: theme?.themeZh || list.chapter.replace(/^Chapter\s+\d+\s*/i, ""),
      listId: list.number,
      mnemonic,
      relatedWords: neighbours.map((item) => item.word),
      exampleEnglish,
      exampleChinese,
      exampleSource: isOriginal ? "原创雅思风格例句；非剑桥雅思真题原文" : `用户提供《雅思词汇真经》扫描版，第 ${source.page} 页；OCR 后待人工复核`,
      contentStatus: isOriginal ? "editorial-draft" : "source-ocr-needs-review",
      partOfSpeech: pos(word.definition),
      memoryAid: { kind: sourceMemory ? "source-memory-note" : "semantic-association", noteZh: mnemonic },
      relations: neighbours.map((item) => ({ label: item.word, type: "same-theme", targetWordId: item.id, isExtension: false })),
      collocations,
      example: {
        text: exampleEnglish,
        translationZh: exampleChinese,
        target: word.word,
        sourceType: isOriginal ? "original-ielts-style" : "user-provided-reference",
        sourceTitle: isOriginal ? undefined : "《雅思词汇真经》",
        copyrightStatus: isOriginal ? "Original for 词穹; not copied from an IELTS test." : "User-provided reference scan; verify publication rights before public redistribution.",
      },
      provenance: {
        contentAuthor: isOriginal ? "词穹原创补充" : "原书 OCR 提取",
        reviewStatus: isOriginal ? "draft" : "ocr-needs-human-review",
        updatedAt: "2026-10-16",
      },
    });
  }
}

const payload = {
  schemaVersion: 1,
  status: "full-structural-coverage-mixed-review-status",
  updatedAt: "2026-10-16",
  policy: {
    source: "原书内容保留页码与 OCR 审核状态；无法可靠提取的例句使用原创雅思风格内容。",
    progress: "Only wordId values from vocab.json count toward learning progress.",
    publication: "OCR-derived examples require rights confirmation and human proofreading before public redistribution.",
  },
  entries,
};
fs.writeFileSync(path.join(root, "public/data/vocab-expansions.v1.json"), `${JSON.stringify(payload)}\n`);
console.log(JSON.stringify({ total: allWords.length, entries: entries.length, originalFallbacks: Object.keys(originals).length, demoApproved: demo.size }, null, 2));
