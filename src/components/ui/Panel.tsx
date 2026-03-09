type Props = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Single container for control-panel / dashboard content.
 * Lighter border and no shadow so cards feel like sections rather than heavy boxes.
 */
export function Panel({ children, className = "" }: Props) {
  return (
    <div
      className={`overflow-visible rounded-panel border border-panel ${className}`.trim()}
      style={{ backgroundColor: "var(--panel-bg)" }}
    >
      {children}
    </div>
  );
}
