"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import type { UserNotificationRow } from "@/lib/userNotificationKinds";
import {
  markAllDashboardNotificationsReadAction,
  markDashboardNotificationReadAction,
} from "@/app/(app)/dashboardNotificationsActions";
import {
  formatNotificationTimestamp,
  notificationBody,
} from "@/lib/notificationDisplay";

type Props = {
  notifications: UserNotificationRow[];
};

export function DashboardNotificationsPanel({ notifications }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const hasUnread = notifications.some((n) => n.read_at == null);

  function afterMarkRead() {
    router.refresh();
  }

  if (notifications.length === 0) {
    return (
      <p className="py-2 text-sm text-text-primary opacity-70">
        No notifications right now.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {hasUnread && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(() => {
                void markAllDashboardNotificationsReadAction().then(afterMarkRead);
              })
            }
          >
            Mark all as read
          </Button>
        </div>
      )}
      <ul className="divide-y divide-border-default overflow-hidden rounded border border-form">
        {notifications.map((n) => {
          const unread = n.read_at == null;
          const { text } = notificationBody(n);
          return (
            <li
              key={n.id}
              className={`flex gap-2 px-3 py-3 text-sm ${
                unread ? "bg-bg-muted/40" : "opacity-70"
              }`}
            >
              <div className="min-w-0 flex-1 text-text-primary">
                <div className="leading-snug">{text}</div>
                <time
                  className="mt-1.5 block text-xs tabular-nums text-text-tertiary"
                  dateTime={n.created_at}
                >
                  {formatNotificationTimestamp(n.created_at)}
                </time>
              </div>
              {unread && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(() => {
                      void markDashboardNotificationReadAction(n.id).then(
                        afterMarkRead
                      );
                    })
                  }
                  className="shrink-0 self-start rounded p-1 text-text-tertiary transition-colors hover:bg-bg-muted hover:text-text-primary disabled:opacity-50"
                  aria-label="Mark as read"
                  title="Mark as read"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
