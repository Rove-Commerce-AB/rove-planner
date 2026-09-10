export type BadgeTone = "success" | "warning" | "danger" | "muted";

export type BadgeVariant =
  | "active"
  | "success"
  | "high"
  | "medium"
  | "warning"
  | "inactive"
  | "low"
  | "error"
  | "muted";

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

const TONE_BY_VARIANT: Record<BadgeVariant, BadgeTone> = {
  active: "success",
  success: "success",
  high: "success",
  medium: "warning",
  warning: "warning",
  inactive: "warning",
  low: "danger",
  error: "danger",
  muted: "muted",
};

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "border-transparent bg-status-success-subtle text-status-success",
  warning: "border-transparent bg-status-warning-subtle text-status-warning",
  danger: "border-transparent bg-status-danger-subtle text-status-danger",
  muted: "border-transparent bg-surface-subtle text-text-secondary",
};

const baseClasses =
  "inline-flex items-center rounded-full border px-3 py-1 text-label-m transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

export function Badge({
  children,
  variant = "muted",
  interactive = false,
  className = "",
  ...rest
}: Props) {
  const combined =
    `${baseClasses} ${TONE_CLASSES[TONE_BY_VARIANT[variant]]} ${className}`.trim();

  if (interactive) {
    const { type = "button", ...buttonProps } =
      rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button type={type} className={`${combined} cursor-pointer`} {...buttonProps}>
        {children}
      </button>
    );
  }

  return <span className={combined}>{children}</span>;
}
