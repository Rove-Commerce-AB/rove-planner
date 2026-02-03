/**
 * Only a thin indeterminate progress bar at the top; no loader page content.
 */
export function PageLoading() {
  return (
    <div
      className="fixed left-0 right-0 top-0 z-50 h-0.5 overflow-hidden bg-bg-muted"
      role="status"
      aria-label="Loading"
    >
      <div
        className="h-full w-1/4 bg-brand-signal animate-loading-bar"
        aria-hidden
      />
    </div>
  );
}
