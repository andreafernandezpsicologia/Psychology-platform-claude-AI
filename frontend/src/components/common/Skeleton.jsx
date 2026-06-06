function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded bg-[var(--border)] ${className}`} />;
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}>
        <SkeletonBlock className="h-3 w-48" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-3 w-40" />
          <SkeletonBlock className="h-5 w-16 rounded-full" />
          <SkeletonBlock className="h-3 w-20 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="bg-white rounded-xl p-5" style={{ border: '1px solid var(--border)' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} className={`h-3 mb-3 ${i === 0 ? 'w-32' : i % 2 === 0 ? 'w-full' : 'w-3/4'}`} />
      ))}
    </div>
  );
}
