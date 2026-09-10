"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { breadcrumbsForPathname } from "@/lib/breadcrumbs";
import { ROUTES } from "@/lib/routes";

type AppTopBarProps = {
  unreadNotificationCount?: number;
};

export function AppTopBar({ unreadNotificationCount = 0 }: AppTopBarProps) {
  const pathname = usePathname();
  const crumbs = breadcrumbsForPathname(pathname);
  const notificationsActive =
    pathname === ROUTES.notifications ||
    pathname.startsWith(`${ROUTES.notifications}/`);
  const hasUnread = unreadNotificationCount > 0;
  const unreadLabel =
    unreadNotificationCount > 99 ? "99+" : String(unreadNotificationCount);

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border-default bg-bg-default px-(--space-32)">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex min-w-0 items-center gap-1.5 text-xs">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                {index > 0 && (
                  <span className="shrink-0 text-text-tertiary" aria-hidden>
                    /
                  </span>
                )}
                {isLast || crumb.href == null ? (
                  <span
                    className={`truncate ${
                      isLast
                        ? "font-semibold text-text-primary"
                        : "text-text-secondary"
                    }`}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    prefetch={false}
                    className="truncate text-text-secondary transition-colors hover:text-text-primary"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <Link
        href={ROUTES.notifications}
        prefetch={false}
        aria-label={
          hasUnread
            ? `Notifications, ${unreadLabel} unread`
            : "Notifications"
        }
        title={
          hasUnread
            ? `Notifications (${unreadNotificationCount} unread)`
            : "Notifications"
        }
        className={`relative flex shrink-0 items-center justify-center rounded-md px-3 py-3 transition-colors hover:bg-nav-hover ${
          notificationsActive
            ? "bg-nav-active text-nav-active-accent"
            : "text-text-primary/70 hover:text-text-primary"
        }`}
      >
        <Bell className="h-5 w-5" />
        {hasUnread && (
          <span className="absolute right-1 top-1 box-border inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-bg-default bg-status-danger px-1 text-label-s leading-none text-text-inverse tabular-nums">
            {unreadLabel}
          </span>
        )}
      </Link>
    </header>
  );
}
