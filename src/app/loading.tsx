export default function Loading() {
  return (
    <div className="flex min-h-[200px] items-center justify-center p-6">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-brand-signal"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
