type Props = {
  /** 0–100 */
  value: number;
  /** Drawer summary uses a larger bar and primary % label. */
  size?: "default" | "drawer";
};

/**
 * Capacity meter for overview lists. Fill uses status/success.
 * Width is data-driven (percentage), not a hardcoded color.
 */
export function CapacityBar({ value, size = "default" }: Props) {
  const pct = Math.max(0, Math.min(100, value));
  const drawer = size === "drawer";
  return (
    <span className={`inline-flex items-center ${drawer ? "gap-3" : "min-w-[7.5rem] gap-2.5"}`}>
      <span
        className={`relative block overflow-hidden rounded-full bg-surface-subtle ${
          drawer ? "h-2.5 w-28" : "h-2 w-24"
        }`}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-status-success"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span
        className={`tabular-nums ${
          drawer
            ? "w-9 text-right text-sm font-medium text-text-primary"
            : "text-xs text-text-secondary"
        }`}
      >
        {pct}%
      </span>
    </span>
  );
}
