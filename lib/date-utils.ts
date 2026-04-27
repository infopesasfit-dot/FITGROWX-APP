/**
 * Adds N calendar months to a date.
 * Clamps to the last valid day if the target month is shorter
 * (e.g. Jan 31 + 1 month → Feb 28, not Mar 2).
 */
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
