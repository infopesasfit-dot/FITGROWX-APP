/**
 * Adds N calendar months to a date.
 * Clamps to the last valid day if the target month is shorter
 * (e.g. Jan 31 + 1 month → Feb 28, not Mar 2).
 */
export const DEFAULT_APP_TIME_ZONE = "America/Argentina/Buenos_Aires";

export function addMonths(from: Date, n: number): Date {
  const result = new Date(from);
  const originalDay = result.getDate();
  result.setMonth(result.getMonth() + n);
  if (result.getDate() !== originalDay) {
    result.setDate(0);
  }
  return result;
}

export function addOneMonth(from: Date): Date {
  return addMonths(from, 1);
}

function getFormatter(
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    ...options,
  });
}

export function formatDateInTimeZone(
  date: Date,
  timeZone = DEFAULT_APP_TIME_ZONE,
): string {
  return getFormatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatTimeInTimeZone(
  date: Date,
  timeZone = DEFAULT_APP_TIME_ZONE,
): string {
  return getFormatter(timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function getTodayDate(timeZone = DEFAULT_APP_TIME_ZONE): string {
  return formatDateInTimeZone(new Date(), timeZone);
}

export function getCurrentTime(timeZone = DEFAULT_APP_TIME_ZONE): string {
  return formatTimeInTimeZone(new Date(), timeZone);
}
