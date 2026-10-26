// One place that turns database timestamps ("2026-09-10T11:27:25.375+00:00") into
// something readable ("Sep 10, 2026"). Returns '' for an empty/invalid value.
export function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
