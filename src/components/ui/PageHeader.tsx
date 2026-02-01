type Props = {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, children, className = "" }: Props) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}>
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-text-primary opacity-70">{description}</p>
        )}
      </div>
      {children}
    </header>
  );
}
