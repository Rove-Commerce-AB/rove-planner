"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import {
  getUnreadDashboardNotificationsAction,
  markAllDashboardNotificationsReadAction,
  markDashboardNotificationReadAction,
} from "@/app/(app)/dashboardNotificationsActions";
import {
  formatNotificationTimestamp,
  notificationBody,
} from "@/lib/notificationDisplay";
import { ROUTES } from "@/lib/routes";
import type { UserNotificationRow } from "@/lib/userNotificationKinds";

type Props = {
  unreadCount: number;
};

export function NotificationsBellDropdown({ unreadCount }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserNotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  const notificationsActive =
    pathname === ROUTES.notifications ||
    pathname.startsWith(`${ROUTES.notifications}/`);
  const hasUnread = unreadCount > 0;
  const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void getUnreadDashboardNotificationsAction()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, unreadCount]);

  function refreshShell() {
    router.refresh();
  }

  function markOne(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    startTransition(() => {
      void markDashboardNotificationReadAction(id).then(refreshShell);
    });
  }

  function markAll() {
    setItems([]);
    startTransition(() => {
      void markAllDashboardNotificationsReadAction().then(() => {
        setOpen(false);
        refreshShell();
      });
    });
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={
          hasUnread
            ? `Notifications, ${unreadLabel} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        title={
          hasUnread
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center justify-center rounded-md px-3 py-3 transition-colors hover:bg-nav-hover ${
          open || notificationsActive
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
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-1 flex w-[min(100vw-1.5rem,22rem)] flex-col overflow-hidden rounded-lg border border-form bg-bg-default shadow-lg"
          style={{ borderColor: "var(--panel-border)" }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border-default px-3 py-2.5">
            <span className="text-sm font-semibold text-text-primary">
              Notifications
            </span>
            {items.length > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={markAll}
                className="text-xs font-medium text-brand-signal underline underline-offset-2 hover:opacity-90 disabled:opacity-50"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[min(70vh,24rem)] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-text-secondary">
                Loading…
              </p>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-text-secondary">
                No unread notifications
              </p>
            ) : (
              <ul className="divide-y divide-border-default">
                {items.map((n) => {
                  const { text } = notificationBody(n);
                  return (
                    <li
                      key={n.id}
                      className="flex gap-2 px-3 py-3 text-sm text-text-primary"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="leading-snug">{text}</div>
                        <time
                          className="mt-1.5 block text-xs tabular-nums text-text-tertiary"
                          dateTime={n.created_at}
                        >
                          {formatNotificationTimestamp(n.created_at)}
                        </time>
                      </div>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => markOne(n.id)}
                        className="shrink-0 self-start rounded p-1 text-text-tertiary transition-colors hover:bg-bg-muted hover:text-text-primary disabled:opacity-50"
                        aria-label="Mark as read"
                        title="Mark as read"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border-default px-3 py-2.5">
            <Link
              href={ROUTES.notifications}
              prefetch={false}
              onClick={() => setOpen(false)}
              className="block text-center text-sm font-medium text-brand-signal underline underline-offset-2 hover:opacity-90"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
