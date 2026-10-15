export type Rating = "again" | "hard" | "known";
export type Drill = "recognize" | "recall" | "dictation";

export type RecordItem = {
  stage: number;
  next: string;
  last: string;
  rating: Rating;
  saved?: boolean;
  planNew?: boolean;
  passes?: Record<string, string[]>;
  completed?: string;
};

export type Records = Record<string, RecordItem>;
export type Checkin = { date: string; completed: number; mastered: number; reinforce: number };
export type DailyPlans = Record<string, string[]>;

export type AppStateV2 = {
  schemaVersion: 2;
  records: Records;
  settings: { examDate: string };
  checkins: Checkin[];
  dailyPlans: DailyPlans;
  sessions: Record<string, unknown>;
  meta: { migratedAt?: string; updatedAt: string };
};

export type ListTheme = {
  list: number;
  chapterNumbers: number[];
  themeZh: string;
  themeEn: string;
};

export type VocabularyExtension = {
  wordId: string;
  chapterId?: string;
  chapterTitle?: string;
  listId?: number;
  mnemonic?: string;
  relatedWords?: string[];
  exampleEnglish?: string;
  exampleChinese?: string;
  exampleSource?: string;
  contentStatus?: string;
  partOfSpeech: string[];
  memoryAid?: { kind: string; noteZh: string; caution?: string };
  relations: Array<{ label: string; type: string; targetWordId?: string; isExtension: boolean; noteZh?: string }>;
  collocations: Array<{ text: string; translationZh: string }>;
  example: {
    text: string;
    translationZh: string;
    target: string;
    sourceType: "original-ielts-style" | "licensed" | "public-domain";
    sourceTitle?: string;
    sourceUrl?: string;
    copyrightStatus: string;
  };
  provenance: { reviewStatus: string; updatedAt: string };
};
