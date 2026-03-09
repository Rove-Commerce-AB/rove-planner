type Props = {
  children: React.ReactNode;
  /** Optional right-aligned action (e.g. Add consultant, Add Project). */
  action?: React.ReactNode;
  className?: string;
};

const titleClasses =
  "text-xs font-medium uppercase tracking-wider text-text-primary opacity-65";

/** Fixed height; border below matches panel border; margin for spacing under header. */
const headerRowClasses =
  "relative z-10 flex h-[2rem] flex-shrink-0 flex-row items-center justify-between border-b border-panel bg-bg-muted/20 px-3 py-0 mb-2";

/**
 * Section header for a panel – compact, subtle, reads as section label not form header.
 * Bottom border uses same color as panel border.
 */
export function PanelSectionTitle({ children, action, className = "" }: Props) {
  return (
    <div className={`${headerRowClasses} ${className}`.trim()}>
      <h2 className={titleClasses}>{children}</h2>
      {action != null ? <span className="flex-shrink-0">{action}</span> : null}
    </div>
  );
}
