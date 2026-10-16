import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const vocab = JSON.parse(fs.readFileSync(path.join(root, "public/vocab.json"), "utf8"));
const ocrDir = path.join(root, "tmp/book-ocr");
const output = path.join(root, "tmp/book-reference.v1.json");

const words = vocab.flatMap((list) => list.words.map((word) => ({ ...word, listId: list.number })));
const normalize = (value) => value
  .normalize("NFKD")
  .replace(/[’‘`]/g, "'")
  .replace(/[^a-z0-9' -]/gi, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const idsByHeadword = new Map();
for (const word of words) {
  const key = normalize(word.word);
  if (!idsByHeadword.has(key)) idsByHeadword.set(key, []);
  idsByHeadword.get(key).push(word.id);
}

const pageFiles = fs.existsSync(ocrDir)
  ? fs.readdirSync(ocrDir).filter((name) => /^page-\d+\.json$/.test(name)).sort()
  : [];
const matches = [];

for (const file of pageFiles) {
  const page = Number(file.match(/\d+/)[0]);
  const lines = JSON.parse(fs.readFileSync(path.join(ocrDir, file), "utf8"));
  const heads = lines
    .filter((line) => line.y > 0.1 && line.y < 0.93)
    .map((line) => ({ ...line, key: normalize(line.text) }))
    .filter((line) => idsByHeadword.has(line.key))
    .sort((a, b) => (a.x < 0.5 ? 0 : 1) - (b.x < 0.5 ? 0 : 1) || b.y - a.y);

  for (let index = 0; index < heads.length; index += 1) {
    const head = heads[index];
    const column = head.x < 0.5 ? 0 : 1;
    const next = heads.slice(index + 1).find((item) => (item.x < 0.5 ? 0 : 1) === column);
    const lowerBound = next ? next.y + Math.max(next.height, 0.012) : 0.105;
    const block = lines
      .filter((line) => (line.x < 0.5 ? 0 : 1) === column && line.y < head.y && line.y > lowerBound)
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .map((line) => line.text.trim())
      .filter(Boolean);
    matches.push({
      page,
      headword: head.text,
      normalizedHeadword: head.key,
      confidence: head.confidence,
      column,
      block,
    });
  }
}

// Assign duplicate spellings in original vocabulary order and book order.
const queues = new Map();
for (const match of matches) {
  if (!queues.has(match.normalizedHeadword)) queues.set(match.normalizedHeadword, []);
  queues.get(match.normalizedHeadword).push(match);
}

const entries = {};
for (const word of words) {
  const queue = queues.get(normalize(word.word)) ?? [];
  const match = queue.shift();
  if (!match) continue;
  entries[word.id] = {
    word: word.word,
    listId: word.listId,
    page: match.page,
    ocrConfidence: match.confidence,
    rawLines: match.block,
    source: "《雅思词汇真经》用户提供扫描版，仅用于事实核对；不得直接公开批量转载",
    reviewStatus: "ocr-unreviewed",
  };
}

const payload = {
  schemaVersion: 1,
  sourcePdf: "/Users/apple/Desktop/雅思/真经.pdf",
  sourcePagesProcessed: pageFiles.length,
  generatedAt: new Date().toISOString(),
  totalVocabulary: words.length,
  matchedHeadwords: Object.keys(entries).length,
  entries,
};
fs.writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ pages: pageFiles.length, words: words.length, matched: Object.keys(entries).length, output }, null, 2));
