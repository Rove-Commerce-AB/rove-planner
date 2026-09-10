type Props = {
  title: string;
  /** Native browser tooltip on the heading (e.g. full title when the visible line is truncated elsewhere). */
  titleTooltip?: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  titleTooltip,
  description,
  children,
  className = "",
}: Props) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`.trim()}>
      <div>
        <h1 className="text-heading-xl text-text-primary" title={titleTooltip}>
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-[13px] text-text-secondary">{description}</p>
        )}
      </div>
      {children}
    </header>
  );
}
