# 词汇拓展数据结构 V1

拓展内容与 `public/vocab.json` 分离，通过稳定的 `wordId` 关联。原词库仍是学习进度和 3,693 词总量的唯一依据；扩展词不会写入原词库，也不参与进度分母。

```ts
type ReviewStatus = "draft" | "reviewed" | "approved" | "rejected";
type RelationType = "same-theme" | "synonym" | "antonym" | "word-family" | "hypernym" | "hyponym" | "semantic";

type VocabularyExtension = {
  wordId: string;
  partOfSpeech: string[];
  memoryAid?: {
    kind: "morphology" | "word-family" | "compound" | "semantic-contrast";
    noteZh: string;
    caution?: string;
  };
  relations: Array<{
    label: string;
    type: RelationType;
    targetWordId?: string;
    isExtension: boolean;
    noteZh?: string;
  }>;
  collocations: Array<{
    text: string;
    translationZh: string;
  }>;
  example: {
    text: string;
    translationZh: string;
    target: string;
    sourceType: "original-ielts-style" | "licensed" | "public-domain";
    sourceTitle?: string;
    sourceUrl?: string;
    copyrightStatus: string;
  };
  provenance: {
    contentAuthor: string;
    linguisticSources: string[];
    reviewStatus: ReviewStatus;
    reviewedBy?: string;
    updatedAt: string;
  };
};
```

## 设计约束

- `wordId` 必须存在于原词库；不得用拼写作为主键。
- `targetWordId` 存在时必须指向原词库。没有 ID 的关系词必须标记 `isExtension: true`，且不计入学习进度。
- 每词默认展示 3–5 个关系词，超出部分折叠。
- 例句默认使用明确标注的原创雅思风格句；不得冒充剑桥真题。
- `linguisticSources` 记录词形、词源或搭配核验来源。示范内容在人工验收前保持 `draft`。
- 用户界面采用三层渐进展示：题面层、答案层、拓展层。
- 批量内容只有在示范审核通过后才能生成，并必须经过结构校验与抽样人工审核。

