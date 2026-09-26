type ZonedDateParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

export function getDashboardTimeZone(searchParams: URLSearchParams) {
  const timeZone = searchParams.get("timeZone") ?? "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return timeZone;
  } catch {
    return null;
  }
}

function partsAt(date: Date, timeZone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

/** 指定タイムゾーンの暦日0:00をUTCのDateへ変換する */
export function zonedStartOfDay(year: number, month: number, day: number, timeZone: string) {
  const guess = Date.UTC(year, month - 1, day);
  const actual = partsAt(new Date(guess), timeZone);
  const offset = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second) - guess;
  return new Date(guess - offset);
}

export function formatDashboardDate(date: Date, timeZone: string) {
  const { year, month, day } = partsAt(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getDashboardPeriod(searchParams: URLSearchParams, requireExplicit = false) {
  const timeZone = getDashboardTimeZone(searchParams);
  if (!timeZone) return null;
  const now = partsAt(new Date(), timeZone);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");
  if (requireExplicit && (yearParam === null || monthParam === null)) return null;
  const year = yearParam === null ? now.year : Number(yearParam);
  const month = monthParam === null ? now.month : Number(monthParam);
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  const from = zonedStartOfDay(year, month, 1, timeZone);
  const next = new Date(year, month, 1);
  const to = zonedStartOfDay(next.getFullYear(), next.getMonth() + 1, 1, timeZone);
  return { year, month, timeZone, from, to };
}
