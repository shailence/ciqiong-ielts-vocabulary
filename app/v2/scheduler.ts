import { addLocalDays, addMinutes, localDateKey } from "./date.ts";
import type { Rating, RecordItem } from "./types.ts";

export const REVIEW_INTERVALS = [0, 1, 3, 7, 15, 30, 60] as const;

export function isDue(next: string, now: Date = new Date()): boolean {
  if (/^\d{4}-\d{2}-\d{2}$/.test(next)) return next <= localDateKey(now);
  const timestamp = new Date(next).getTime();
  return Number.isFinite(timestamp) && timestamp <= now.getTime();
}

export function scheduleReview(previous: RecordItem | undefined, rating: Rating, now: Date = new Date()) {
  let stage = previous?.stage || 0;
  if (rating === "again") return { stage: 0, next: addMinutes(10, now.getTime()) };
  if (rating === "hard") return { stage: Math.max(1, stage), next: addLocalDays(1, now) };
  stage = Math.min(6, stage + 1);
  return { stage, next: addLocalDays(REVIEW_INTERVALS[stage], now) };
}
