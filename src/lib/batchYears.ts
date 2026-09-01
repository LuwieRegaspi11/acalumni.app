// Earliest valid alumni batch year. The college was founded in 1972, so the
// first graduating batch could not predate 1975.
export const MIN_BATCH_YEAR = 1975;

/**
 * Returns batch years from the current year down to MIN_BATCH_YEAR,
 * newest first. Recalculated on every call so it never needs a manual
 * yearly update.
 */
export function getBatchYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= MIN_BATCH_YEAR; y--) years.push(y);
  return years;
}
