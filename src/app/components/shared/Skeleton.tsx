// Shimmering placeholder shapes shown while data loads — calmer and more
// polished than a bare "Loading…" line. Uses Tailwind's animate-pulse; the
// colors work on light and dark backgrounds (`tone` picks the glass-on-navy one).

interface BlockProps { className?: string; tone?: 'light' | 'glass' }

export function Skeleton({ className = '', tone = 'light' }: BlockProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg ${tone === 'glass' ? 'bg-white/15' : 'bg-gray-200/80'} ${className}`}
    />
  );
}

// A full-width stack of bars — drop-in replacement for a "Loading…" message.
export function SkeletonLines({ rows = 3, tone = 'light', className = '' }: { rows?: number; tone?: 'light' | 'glass'; className?: string }) {
  const widths = ['w-full', 'w-11/12', 'w-4/5', 'w-9/12', 'w-2/3'];
  return (
    <div role="status" aria-label="Loading" className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} tone={tone} className={`h-4 ${widths[i % widths.length]}`} />)}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// Whole-screen loading state (session restore, etc.).
export function PageSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm space-y-4" role="status" aria-label="Loading">
        <Skeleton className="h-10 w-10 rounded-full mx-auto" />
        <Skeleton className="h-4 w-2/3 mx-auto" />
        <Skeleton className="h-3 w-1/2 mx-auto" />
        <span className="sr-only">Loading…</span>
      </div>
    </div>
  );
}

// Table-row version for data tables.
export function SkeletonTableRows({ cols, rows = 4 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className="px-4 py-4"><Skeleton className="h-4 w-full" /></td>
          ))}
        </tr>
      ))}
    </>
  );
}
