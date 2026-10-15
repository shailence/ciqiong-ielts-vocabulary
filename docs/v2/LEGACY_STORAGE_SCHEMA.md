# V1 本地数据结构备份

本文件固定记录 V2 开发前的浏览器数据格式，供迁移器、回滚和导入兼容使用。V2 不应修改或删除这些旧键。

## `ielts-vocab-records`

```ts
type LegacyRating = "again" | "hard" | "known";

type LegacyRecordItem = {
  stage: number;
  next: string;
  last: string;
  rating: LegacyRating;
  saved?: boolean;
  planNew?: boolean;
  passes?: Record<string, string[]>;
  completed?: string;
};

type LegacyRecords = Record<string, LegacyRecordItem>;
```

`next` 可能是 `YYYY-MM-DD`，也可能是带时间的 ISO 字符串。

## `ielts-exam-date`

```ts
type LegacyExamDate = string; // YYYY-MM-DD 或空字符串
```

## `ielts-plan-YYYY-MM-DD`

```ts
type LegacyDailyPlan = string[]; // Word.id[]
```

## `ielts-checkins`

```ts
type LegacyCheckin = {
  date: string;
  completed: number;
  mastered: number;
  reinforce: number;
};

type LegacyCheckins = LegacyCheckin[];
```

## 迁移约束

1. 先验证旧值类型，再迁移可识别字段。
2. 无法识别的字段原样放入迁移备份，不静默删除。
3. V2 首次迁移前写入带时间戳的旧数据备份键。
4. 收藏、阶段、下次复习时间和打卡不得重置。
5. 同一旧数据只迁移一次，迁移过程必须幂等。

