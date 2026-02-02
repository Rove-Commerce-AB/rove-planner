type Props = {
  title?: string;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Optional footer (e.g. Save button) – anchored inside the section, not floating */
  footer?: React.ReactNode;
  className?: string;
};

/**
 * A section inside a Panel. Use border-t so sections hang together.
 * Put actions (e.g. Save) in footer so buttons don't float freely.
 */
export function PanelSection({
  title,
  icon,
  description,
  children,
  footer,
  className = "",
}: Props) {
  return (
    <section
      className={`border-t border-border first:border-t-0 ${className}`.trim()}
    >
      <div className="p-6">
        {(title ?? icon ?? description) && (
          <div className="mb-4">
            {(title ?? icon) && (
              <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                {icon}
                {title}
              </h2>
            )}
            {description && (
              <div className="mt-1 text-sm text-text-primary opacity-70">
                {description}
              </div>
            )}
          </div>
        )}
        {children}
        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </section>
  );
}
