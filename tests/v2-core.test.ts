import test from "node:test";
import assert from "node:assert/strict";
import { addLocalDays, localDateKey } from "../app/v2/date.ts";
import { isDue, scheduleReview } from "../app/v2/scheduler.ts";
import { loadState, V2_BACKUP_KEY, V2_STORAGE_KEY } from "../app/v2/storage.ts";

class MemoryStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

test("localDateKey uses local calendar date instead of UTC", () => {
  const date = new Date(2026, 9, 15, 0, 30, 0);
  assert.equal(localDateKey(date), "2026-10-15");
  assert.equal(addLocalDays(1, date), "2026-10-16");
});

test("review scheduling preserves the current policy", () => {
  const now = new Date(2026, 9, 15, 9, 0, 0);
  assert.equal(scheduleReview(undefined, "known", now).next, "2026-10-16");
  assert.equal(scheduleReview({ stage: 1, next: "", last: "", rating: "known" }, "known", now).next, "2026-10-18");
  assert.equal(scheduleReview(undefined, "hard", now).next, "2026-10-16");
  assert(isDue("2026-10-15", now));
  assert(!isDue("2026-10-16", now));
});

test("legacy data migrates without deleting legacy keys", () => {
  const storage = new MemoryStorage();
  storage.setItem("ielts-vocab-records", JSON.stringify({ "l1-1": { stage: 1, next: "2026-10-16", last: "2026-10-15", rating: "known" } }));
  storage.setItem("ielts-exam-date", "2026-12-01");
  storage.setItem("ielts-checkins", JSON.stringify([{ date: "2026-10-15", completed: 10, mastered: 8, reinforce: 2 }]));
  storage.setItem("ielts-plan-2026-10-15", JSON.stringify(["l1-1"]));
  const state = loadState(storage, new Date("2026-10-15T01:00:00.000Z"));
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.records["l1-1"].stage, 1);
  assert.deepEqual(state.dailyPlans["2026-10-15"], ["l1-1"]);
  assert(storage.getItem(V2_STORAGE_KEY));
  assert(storage.getItem("ielts-vocab-records"));
});

test("invalid V2 data is backed up before legacy recovery", () => {
  const storage = new MemoryStorage();
  storage.setItem(V2_STORAGE_KEY, "{\"broken\":true}");
  loadState(storage);
  assert.equal(storage.getItem(V2_BACKUP_KEY), "{\"broken\":true}");
});
