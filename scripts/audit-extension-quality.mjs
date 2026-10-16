import fs from "node:fs";

const vocab = JSON.parse(fs.readFileSync("public/vocab.json", "utf8"));
const payload = JSON.parse(fs.readFileSync("public/data/vocab-expansions.v1.json", "utf8"));
const words = vocab.flatMap((list) => list.words.map((word) => ({ ...word, list: list.number })));
const wordIds = new Set(words.map((word) => word.id));
const entries = payload.entries;
const counts = {
  lists: vocab.length,
  words: words.length,
  uniqueWordIds: wordIds.size,
  extensions: entries.length,
  missingExtensions: words.filter((word) => !entries.some((entry) => entry.wordId === word.id)).length,
  orphanExtensions: entries.filter((entry) => !wordIds.has(entry.wordId)).length,
  withExample: 0,
  withTranslation: 0,
  withMnemonic: 0,
  withRelations: 0,
  withCollocations: 0,
  originalDraft: 0,
  ocrNeedsReview: 0,
  exampleTargetNeedsReview: 0,
  punctuationNeedsReview: 0,
};

const issues = [];
for (const entry of entries) {
  if (entry.example?.text) counts.withExample += 1;
  if (entry.example?.translationZh) counts.withTranslation += 1;
  if (entry.memoryAid?.noteZh) counts.withMnemonic += 1;
  if (entry.relations?.length) counts.withRelations += 1;
  if (entry.collocations?.length) counts.withCollocations += 1;
  if (entry.provenance?.reviewStatus === "draft") counts.originalDraft += 1;
  if (entry.provenance?.reviewStatus === "ocr-needs-human-review") counts.ocrNeedsReview += 1;
  const text = entry.example?.text?.trim() || "";
  const target = entry.example?.target?.toLowerCase() || "";
  const stem = target.replace(/(?:ing|ed|es|s|e)$/i, "");
  if (target && !text.toLowerCase().includes(target) && stem.length > 3 && !text.toLowerCase().includes(stem)) {
    counts.exampleTargetNeedsReview += 1;
    issues.push({ wordId: entry.wordId, kind: "target-not-found", text });
  }
  if (text && !/[.!?][”"']?$/.test(text)) {
    counts.punctuationNeedsReview += 1;
    issues.push({ wordId: entry.wordId, kind: "possibly-truncated", text });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  conclusion: counts.missingExtensions === 0 && counts.orphanExtensions === 0
    ? "结构覆盖完整；OCR 来源内容尚未完成逐条人工校对。"
    : "结构覆盖不完整。",
  counts,
  qualityPolicy: {
    structuralCoverageIsNotEditorialApproval: true,
    ocrEntriesAreDisplayedWithWarning: true,
    publicationRightsStillRequireOwnerConfirmation: true,
  },
  sampleIssues: issues.slice(0, 100),
};

fs.writeFileSync("docs/v2/extension-quality-audit.json", `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync("docs/v2/extension-quality-audit.md", `# 词汇拓展质量审计\n\n生成时间：${report.generatedAt}\n\n- 词库：${counts.lists} Lists / ${counts.words} 词\n- 结构化拓展：${counts.extensions}（缺失 ${counts.missingExtensions}，孤立 ${counts.orphanExtensions}）\n- 英文例句：${counts.withExample}\n- 中文翻译：${counts.withTranslation}\n- 联想记忆：${counts.withMnemonic}\n- 主题关联：${counts.withRelations}\n- 搭配：${counts.withCollocations}\n- 原创草稿：${counts.originalDraft}\n- OCR 待人工复核：${counts.ocrNeedsReview}\n- 目标词匹配待复核：${counts.exampleTargetNeedsReview}\n- 疑似截断待复核：${counts.punctuationNeedsReview}\n\n> 结论：${report.conclusion} 字段存在不等于语言质量审核通过。\n`);
console.log(JSON.stringify(report.counts, null, 2));
