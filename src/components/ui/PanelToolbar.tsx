type Props = {
  /** Left: search / filter controls */
  left?: React.ReactNode;
  /** Right: primary CTA (e.g. Add button) */
  right?: React.ReactNode;
  className?: string;
};

/**
 * Panel toolbar: search/filters (left) + primary CTA (right).
 * Used inside Panel (DESIGN_SYSTEM + UI_PATTERNS).
 */
export function PanelToolbar({
  left,
  right,
  className = "",
}: Props) {
  if (left == null && right == null) return null;
  return (
    <div
      className={`flex flex-col gap-1 border-b border-form/60 px-3 py-1 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}
    >
      {left != null && <div className="min-w-0 flex-1">{left}</div>}
      {right != null && <div className="flex flex-shrink-0">{right}</div>}
    </div>
  );
}
