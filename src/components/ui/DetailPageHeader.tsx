import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
  backHref: string;
  backLabel: string;
  /** Avatar: initials in a circle, or custom node (e.g. logo image) */
  avatar: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  /** Right slot: e.g. Delete button */
  action?: React.ReactNode;
  className?: string;
};

/**
 * Unified header for detail pages (consultant, customer, project).
 * Back link + avatar + title + subtitle + primary action so the page feels like a control panel.
 */
export function DetailPageHeader({
  backHref,
  backLabel,
  avatar,
  title,
  subtitle,
  action,
  className = "",
}: Props) {
  return (
    <header
      className={`mb-6 flex flex-col gap-4 ${className}`.trim()}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-text-primary opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2"
          aria-label={backLabel}
        >
          <ArrowLeft className="h-5 w-5" />
          <span>{backLabel}</span>
        </Link>
        {action && <div className="flex flex-shrink-0">{action}</div>}
      </div>
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-muted text-xl font-semibold text-text-primary">
          {avatar}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-text-primary">
            {title}
          </h1>
          {subtitle != null && (
            <p className="mt-0.5 text-sm text-text-primary opacity-70">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
