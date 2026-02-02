type Props = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Single container for control-panel / dashboard content.
 * Sections inside should use PanelSection so content "hangs together" with dividers.
 */
export function Panel({ children, className = "" }: Props) {
  return (
    <div
      className={`overflow-hidden rounded-panel border border-border ${className}`.trim()}
      style={{ backgroundColor: 'var(--panel-bg)' }}
    >
      {children}
    </div>
  );
}
