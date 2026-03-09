type BadgeVariant = "active" | "inactive" | "success" | "muted";

type Props = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  /** When true, renders as a button (for toggleable status e.g. Active/Inactive). */
  interactive?: boolean;
  className?: string;
} & (
  | { interactive?: false }
  | (React.ButtonHTMLAttributes<HTMLButtonElement> & { interactive: true })
);

const variantClasses: Record<BadgeVariant, string> = {
  active:
    "border-[var(--color-brand-blue)] bg-brand-blue/50 text-text-primary hover:bg-brand-blue/70",
  inactive:
    "border-form bg-bg-muted text-text-primary opacity-70 hover:bg-bg-muted/80",
  success:
    "border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300",
  muted:
    "border-form bg-bg-muted text-text-primary opacity-70",
};

const baseClasses =
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

export function Badge({
  children,
  variant = "muted",
  interactive = false,
  className = "",
  ...rest
}: Props) {
  const combined = `${baseClasses} ${variantClasses[variant]} ${className}`.trim();

  if (interactive) {
    const { type = "button", ...buttonProps } = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button type={type} className={`${combined} cursor-pointer`} {...buttonProps}>
        {children}
      </button>
    );
  }

  return <span className={combined}>{children}</span>;
}
