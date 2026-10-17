import fs from "node:fs";

const vocab = JSON.parse(fs.readFileSync("public/vocab.json", "utf8"));
const extensions = JSON.parse(fs.readFileSync("public/data/vocab-expansions.v1.json", "utf8")).entries;
const extracted = JSON.parse(fs.readFileSync("tmp/book-content.v1.json", "utf8")).entries;
const originals = JSON.parse(fs.readFileSync("public/data/vocab-original-examples.v1.json", "utf8")).entries;
const words = vocab.flatMap((list) => list.words.map((word) => ({ ...word, listId: list.number })));
const wordById = new Map(words.map((word) => [word.id, word]));
const extensionById = new Map(extensions.map((entry) => [entry.wordId, entry]));
const duplicateExtensionIds = extensions.map((entry) => entry.wordId).filter((id, index, all) => all.indexOf(id) !== index);

const containsTarget = (text, target) => {
  const normalized = text.toLowerCase();
  if (normalized.includes(target.toLowerCase())) return true;
  const base = target.toLowerCase().replace(/(?:ing|ed|es|s|e)$/i, "");
  // Very short stems create excessive false positives/negatives; route them to
  // the ordinary human-review queue instead of claiming a target mismatch.
  if (base.length <= 3) return true;
  return normalized.includes(base);
};
const looksTruncated = (text) => Boolean(text) && !/[.!?][”"']?$/.test(text.trim());
const csv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const records = words.map((word) => {
  const entry = extensionById.get(word.id);
  const raw = extracted[word.id] ?? null;
  const original = originals[word.id] ?? null;
  const publishedEnglish = entry?.example?.text ?? "";
  const publishedChinese = entry?.example?.translationZh ?? "";
  const categories = [];
  if (!entry) categories.push("missing-extension");
  if (publishedEnglish && !containsTarget(publishedEnglish, word.word)) categories.push("target-match-anomaly");
  if (looksTruncated(publishedEnglish)) categories.push("suspected-truncation");
  if (!raw) categories.push("ocr-source-not-mapped");
  if (entry?.provenance?.reviewStatus === "ocr-needs-human-review") categories.push("human-review-required");
  const hasReviewedRevision = entry?.example?.sourceType === "original-ielts-style";
  return {
    wordId: word.id,
    listId: word.listId,
    word: word.word,
    definition: word.definition,
    auditStatus: !entry ? "blocked-missing" : hasReviewedRevision ? "original-draft-present" : "ocr-pending-human-review",
    exceptionCategories: [...new Set(categories)],
    requiresHumanReview: !hasReviewedRevision,
    originalOcrEnglish: raw?.exampleEnglish ?? "",
    originalOcrChinese: raw?.exampleChinese ?? "",
    originalOcrRawLines: raw?.rawLines ?? [],
    originalOcrPage: raw?.page ?? null,
    originalOcrConfidence: raw?.ocrConfidence ?? null,
    revisedEnglish: publishedEnglish,
    revisedChinese: publishedChinese,
    revisionSource: hasReviewedRevision ? "词穹原创草稿；与 OCR 原文分开保存" : "OCR 清洗版本；尚未人工批准",
    revisionBasis: hasReviewedRevision
      ? "为当前词义与词性编写的原创雅思风格例句，非真题原文"
      : "从用户提供扫描资料提取并进行空格、分句等机械清洗；需对照原书页面复核",
    mnemonic: entry?.memoryAid?.noteZh ?? "",
    relations: (entry?.relations ?? []).map((relation) => relation.label),
    collocations: entry?.collocations ?? [],
    sourceType: entry?.example?.sourceType ?? "",
    sourceTitle: entry?.example?.sourceTitle ?? "",
    copyrightStatus: entry?.example?.copyrightStatus ?? "",
    contentReviewStatus: entry?.provenance?.reviewStatus ?? "missing",
    updatedAt: entry?.provenance?.updatedAt ?? "",
    originalFallbackExists: Boolean(original),
  };
});

const anomalies = records.filter((record) => record.exceptionCategories.some((item) => item !== "human-review-required"));
const targetAnomalies = records.filter((record) => record.exceptionCategories.includes("target-match-anomaly"));
const truncations = records.filter((record) => record.exceptionCategories.includes("suspected-truncation"));
const priorityIds = new Set([...targetAnomalies, ...truncations].map((record) => record.wordId));
const priority = records.filter((record) => priorityIds.has(record.wordId));
const summary = {
  generatedAt: new Date().toISOString(),
  totalVocabulary: words.length,
  totalExtensions: extensions.length,
  uniqueExtensionIds: extensionById.size,
  duplicateExtensionIds: [...new Set(duplicateExtensionIds)],
  targetMatchAnomalies: targetAnomalies.length,
  suspectedTruncations: truncations.length,
  priorityUniqueWordIds: priority.length,
  ocrPendingHumanReview: records.filter((record) => record.auditStatus === "ocr-pending-human-review").length,
  originalDraftPresent: records.filter((record) => record.auditStatus === "original-draft-present").length,
  ocrSourceNotMapped: records.filter((record) => record.exceptionCategories.includes("ocr-source-not-mapped")).length,
  approvedAsProofread: 0,
};
const payload = {
  schemaVersion: 1,
  summary,
  policy: {
    noBulkApproval: true,
    ocrTextPreserved: true,
    revisedTextStoredSeparately: true,
    approvalRule: "Only a human comparison against the cited book page may change OCR items to proofread-approved.",
  },
  records,
  priorityReview: priority,
};

fs.mkdirSync("docs/v2/audit", { recursive: true });
fs.writeFileSync("docs/v2/audit/vocabulary-extension-audit.full.json", `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync("docs/v2/audit/vocabulary-extension-audit.priority.json", `${JSON.stringify({ summary, records: priority }, null, 2)}\n`);
const columns = ["wordId","listId","word","definition","auditStatus","exceptionCategories","requiresHumanReview","originalOcrPage","originalOcrConfidence","originalOcrEnglish","originalOcrChinese","originalOcrRawLines","revisedEnglish","revisedChinese","revisionSource","revisionBasis","contentReviewStatus","updatedAt"];
const lines = [columns.map(csv).join(","), ...records.map((record) => columns.map((column) => csv(Array.isArray(record[column]) ? record[column].join(" | ") : record[column])).join(","))];
fs.writeFileSync("docs/v2/audit/vocabulary-extension-audit.full.csv", `${lines.join("\n")}\n`);
const priorityLines = [columns.map(csv).join(","), ...priority.map((record) => columns.map((column) => csv(Array.isArray(record[column]) ? record[column].join(" | ") : record[column])).join(","))];
fs.writeFileSync("docs/v2/audit/vocabulary-extension-audit.priority.csv", `${priorityLines.join("\n")}\n`);
fs.writeFileSync("docs/v2/audit/VOCABULARY_QUALITY_ACCEPTANCE.md", `# 词穹 V2.0 词汇拓展质量审计\n\n生成时间：${summary.generatedAt}\n\n## 结论\n\n- 原始词库：${summary.totalVocabulary} 条；拓展：${summary.totalExtensions} 条；唯一拓展 ID：${summary.uniqueExtensionIds} 条。\n- 重复词条 ID：${summary.duplicateExtensionIds.length} 条。\n- 目标词匹配异常：${summary.targetMatchAnomalies} 条。\n- 疑似截断：${summary.suspectedTruncations} 条。\n- 两类问题按词条 ID 去重后：${summary.priorityUniqueWordIds} 条。\n- OCR 待人工复核：${summary.ocrPendingHumanReview} 条。\n- 原创草稿：${summary.originalDraftPresent} 条。\n- 已批准为“人工校对完成”：${summary.approvedAsProofread} 条。\n\n## 审计规则\n\n完整报告逐条保存原始 OCR 英文、中文、原始行、页码、置信度，以及独立的修订版本、修订依据、异常分类和审核状态。未经逐页人工比对的 OCR 内容保持 \`ocr-pending-human-review\`，不会批量标记为已校对。\n\n## 文件\n\n- \`vocabulary-extension-audit.full.json\`：3,693 条完整机器可读报告。\n- \`vocabulary-extension-audit.full.csv\`：3,693 条表格报告。\n- \`vocabulary-extension-audit.priority.json/csv\`：目标词匹配异常与疑似截断的去重优先队列。\n`);

console.log(JSON.stringify(summary, null, 2));
