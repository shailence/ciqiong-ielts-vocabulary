import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const vocab = await readJson("public/vocab.json");
const themes = await readJson("public/data/list-themes.v1.json");
const demo = await readJson("public/data/vocab-expansions.demo.v1.json");

const lists = Array.isArray(vocab) ? vocab : vocab.lists;
assert.equal(lists.length, 64, "原始词库必须保留 64 个 List");

const words = lists.flatMap((list) => list.words);
const ids = new Set(words.map((word) => word.id));
assert.equal(ids.size, words.length, "原始词条 ID 必须唯一");

assert.equal(themes.lists.length, 64, "主题表必须覆盖 64 个 List");
assert.deepEqual(
  themes.lists.map((item) => item.list),
  Array.from({ length: 64 }, (_, index) => index + 1),
  "主题表必须按 List 1–64 连续排列",
);

assert.equal(demo.entries.length, 30, "示范内容必须恰好包含 30 个词条");
assert.equal(new Set(demo.entries.map((entry) => entry.wordId)).size, 30, "示范词条不得重复");
assert.equal(demo.demoGroups.length, 3, "示范内容必须包含三个主题");
assert.deepEqual(demo.demoGroups[0].wordIds, lists[0].words.slice(0, 10).map((word) => word.id), "Chapter 01 示例必须使用 List 01 前 10 个真实词条");

const demoIds = new Set(demo.entries.map((entry) => entry.wordId));
for (const group of demo.demoGroups) {
  assert.equal(group.wordIds.length, 10, `${group.themeZh} 必须包含 10 个示范词`);
  for (const wordId of group.wordIds) assert(demoIds.has(wordId), `${wordId} 未出现在示范词条中`);
}

for (const entry of demo.entries) {
  assert(ids.has(entry.wordId), `${entry.wordId} 不存在于原始词库`);
  assert(entry.partOfSpeech?.length, `${entry.wordId} 缺少词性`);
  assert(entry.memoryAid?.noteZh, `${entry.wordId} 缺少联想记忆`);
  assert(entry.relations.length >= 3 && entry.relations.length <= 5, `${entry.wordId} 关联词应为 3–5 个`);
  assert(entry.collocations.length >= 2, `${entry.wordId} 至少需要两个高频搭配`);
  assert.equal(entry.example.sourceType, "original-ielts-style", `${entry.wordId} 示例不得伪装成真题`);
  assert(entry.example.copyrightStatus, `${entry.wordId} 缺少版权状态`);
  assert(entry.example.text.toLowerCase().includes(entry.example.target.toLowerCase()), `${entry.wordId} 例句未包含目标词`);
  assert(entry.provenance?.reviewStatus, `${entry.wordId} 缺少审核状态`);
  assert(entry.provenance?.updatedAt, `${entry.wordId} 缺少更新时间`);
  assert(entry.chapterId && entry.chapterTitle && entry.listId, `${entry.wordId} 缺少章节或 List 字段`);
  assert(entry.mnemonic && entry.relatedWords?.length, `${entry.wordId} 缺少独立拓展字段`);
  assert(entry.exampleEnglish && entry.exampleChinese && entry.exampleSource, `${entry.wordId} 缺少例句扁平字段`);
  assert(entry.contentStatus, `${entry.wordId} 缺少内容审核状态`);

  for (const relation of entry.relations) {
    if (!relation.isExtension) {
      assert(relation.targetWordId, `${entry.wordId} 的词库内关联缺少 targetWordId`);
      assert(ids.has(relation.targetWordId), `${entry.wordId} 指向不存在的词条 ${relation.targetWordId}`);
    }
  }
}

console.log(`V2 内容校验通过：${lists.length} Lists，${words.length} 原始词条，${demo.entries.length} 条拓展示范。`);
