export function DashboardSkeleton() {
  return (
    <div className="p-6">
      <header className="mb-6">
        <div className="h-8 w-48 animate-pulse rounded bg-bg-muted" />
        <div className="mt-2 h-4 w-32 animate-pulse rounded bg-bg-muted" />
      </header>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-border bg-bg-default"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg border border-border bg-bg-default" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-bg-default" />
      </div>
    </div>
  );
}
