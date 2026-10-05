export function DashboardSkeleton() {
  return (
    <div className="w-full max-w-5xl">
      <header className="mb-8">
        <div className="h-3 w-24 animate-pulse rounded bg-bg-muted" />
        <div className="mt-2 h-8 w-48 animate-pulse rounded bg-bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-bg-muted" />
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-panel border border-panel bg-bg-default"
          />
        ))}
      </div>
    </div>
  );
}
