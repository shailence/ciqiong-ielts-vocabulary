import type { AppStateV2, Checkin, DailyPlans, Records } from "./types.ts";

export const V2_STORAGE_KEY = "ciqiong-v2-state";
export const V2_BACKUP_KEY = "ciqiong-v2-backup";
const LEGACY_RECORDS_KEY = "ielts-vocab-records";
const LEGACY_EXAM_KEY = "ielts-exam-date";
const LEGACY_CHECKINS_KEY = "ielts-checkins";
const LEGACY_PLAN_PREFIX = "ielts-plan-";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "length" | "key">;

const parse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};

export function emptyState(now = new Date()): AppStateV2 {
  return {
    schemaVersion: 2,
    records: {},
    settings: { examDate: "" },
    checkins: [],
    dailyPlans: {},
    sessions: {},
    meta: { updatedAt: now.toISOString() },
  };
}

export function isAppStateV2(value: unknown): value is AppStateV2 {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<AppStateV2>;
  return state.schemaVersion === 2 && !!state.records && typeof state.records === "object"
    && Array.isArray(state.checkins) && !!state.dailyPlans && typeof state.dailyPlans === "object"
    && !!state.settings && typeof state.settings.examDate === "string";
}

export function migrateLegacy(storage: StorageLike, now = new Date()): AppStateV2 {
  const records = parse<Records>(storage.getItem(LEGACY_RECORDS_KEY), {});
  const checkins = parse<Checkin[]>(storage.getItem(LEGACY_CHECKINS_KEY), []);
  const dailyPlans: DailyPlans = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(LEGACY_PLAN_PREFIX)) continue;
    const ids = parse<unknown>(storage.getItem(key), []);
    if (Array.isArray(ids) && ids.every((id) => typeof id === "string")) {
      dailyPlans[key.slice(LEGACY_PLAN_PREFIX.length)] = ids;
    }
  }
  return {
    ...emptyState(now),
    records: records && typeof records === "object" ? records : {},
    settings: { examDate: storage.getItem(LEGACY_EXAM_KEY) || "" },
    checkins: Array.isArray(checkins) ? checkins : [],
    dailyPlans,
    meta: { migratedAt: now.toISOString(), updatedAt: now.toISOString() },
  };
}

export function loadState(storage: StorageLike, now = new Date()): AppStateV2 {
  const raw = storage.getItem(V2_STORAGE_KEY);
  if (raw) {
    const parsed = parse<unknown>(raw, null);
    if (isAppStateV2(parsed)) return parsed;
    storage.setItem(V2_BACKUP_KEY, raw);
  }
  const migrated = migrateLegacy(storage, now);
  saveState(storage, migrated, now);
  return migrated;
}

export function saveState(storage: StorageLike, state: AppStateV2, now = new Date()): AppStateV2 {
  const next = { ...state, meta: { ...state.meta, updatedAt: now.toISOString() } };
  storage.setItem(V2_STORAGE_KEY, JSON.stringify(next));
  storage.setItem(LEGACY_RECORDS_KEY, JSON.stringify(next.records));
  storage.setItem(LEGACY_EXAM_KEY, next.settings.examDate);
  storage.setItem(LEGACY_CHECKINS_KEY, JSON.stringify(next.checkins));
  for (const [date, ids] of Object.entries(next.dailyPlans)) {
    storage.setItem(`${LEGACY_PLAN_PREFIX}${date}`, JSON.stringify(ids));
  }
  return next;
}
