import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const input = JSON.parse(fs.readFileSync(path.join(root, "tmp/book-reference.v1.json"), "utf8"));
const clean = (value) => value
  .replace(/^\s*\[[^\]]{0,8}\]\s*/u, "")
  .replace(/[^\x20-\x7E]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const sentenceFor = (entry) => {
  const lines = entry.rawLines.map(clean).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const joined = `${lines[index]} ${lines[index + 1] ?? ""}`.replace(/\s+/g, " ").trim();
    const sentence = joined.match(/[A-Z][A-Za-z0-9,'’()\-\s]+[.!?]/)?.[0];
    if (sentence && sentence.toLowerCase().includes(entry.word.toLowerCase()) && sentence.split(/\s+/).length >= 5) {
      return sentence;
    }
  }
  return null;
};

const collocationsFor = (entry, example) => entry.rawLines
  .map(clean)
  .filter((line) => line.toLowerCase().includes(entry.word.toLowerCase()))
  .filter((line) => line !== example && !/[.!?]$/.test(line))
  .filter((line) => line.split(/\s+/).length <= 10)
  .slice(0, 3);

let examples = 0;
let morphology = 0;
let collocations = 0;
const candidates = {};
for (const [wordId, entry] of Object.entries(input.entries)) {
  const example = sentenceFor(entry);
  const mnemonicLines = entry.rawLines.filter((line) => /\+|→|->/.test(line));
  const collocationLines = collocationsFor(entry, example);
  if (example) examples += 1;
  if (mnemonicLines.length) morphology += 1;
  if (collocationLines.length) collocations += 1;
  candidates[wordId] = {
    word: entry.word,
    page: entry.page,
    exampleCandidate: example,
    collocationCandidates: collocationLines,
    morphologyCandidates: mnemonicLines,
    reviewStatus: "ocr-candidate-not-for-publication",
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  sourcePagesProcessed: input.sourcePagesProcessed,
  totalVocabulary: input.totalVocabulary,
  matchedHeadwords: Object.keys(input.entries).length,
  exampleCandidates: examples,
  collocationCandidates: collocations,
  morphologyCandidates: morphology,
  candidates,
};
fs.writeFileSync(path.join(root, "tmp/book-reference-candidates.v1.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  pages: report.sourcePagesProcessed,
  total: report.totalVocabulary,
  matched: report.matchedHeadwords,
  examples,
  collocations,
  morphology,
}, null, 2));
