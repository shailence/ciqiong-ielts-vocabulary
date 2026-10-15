const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function localDateKey(input: Date = new Date()): string {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const date = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

export function addLocalDays(days: number, input: Date = new Date()): string {
  const value = new Date(input);
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + days);
  return localDateKey(value);
}

export function addMinutes(minutes: number, now = Date.now()): string {
  return new Date(now + minutes * 60_000).toISOString();
}

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && DATE_PATTERN.test(value);
}
