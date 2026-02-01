export default function AllocationLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 h-7 w-32 animate-pulse rounded bg-bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded bg-bg-muted" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-lg bg-bg-muted" />
      </div>
      <div className="mb-4 flex gap-2 border-b border-border">
        <div className="h-9 w-28 animate-pulse rounded bg-bg-muted" />
        <div className="h-9 w-28 animate-pulse rounded bg-bg-muted" />
      </div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="h-9 w-24 animate-pulse rounded bg-bg-muted" />
        <div className="flex gap-1">
          <div className="h-9 w-9 animate-pulse rounded bg-bg-muted" />
          <div className="h-9 w-9 animate-pulse rounded bg-bg-muted" />
        </div>
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-border bg-bg-default" />
    </div>
  );
}
