type Props = {
  title: string;
  subtitle?: React.ReactNode;
  /** Right-aligned primary action area */
  children?: React.ReactNode;
  className?: string;
};

/**
 * Panel header: title + optional subtitle/metrics + primary action area.
 * Used inside Panel for overview/detail views (DESIGN_SYSTEM + UI_PATTERNS).
 */
export function PanelHeader({
  title,
  subtitle,
  children,
  className = "",
}: Props) {
  return (
    <div
      className={`flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}
    >
      <div>
        <h1 className="text-xl font-bold text-text-primary">{title}</h1>
        {subtitle != null && (
          <p className="mt-0.5 text-sm text-text-primary opacity-70">
            {subtitle}
          </p>
        )}
      </div>
      {children != null && <div className="flex flex-shrink-0">{children}</div>}
    </div>
  );
}
