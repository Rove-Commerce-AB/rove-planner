"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import type { UserNotificationRow } from "@/lib/userNotificationKinds";
import { USER_NOTIFICATION_KIND } from "@/lib/userNotificationKinds";
import {
  markAllDashboardNotificationsReadAction,
  markDashboardNotificationReadAction,
} from "@/app/(app)/dashboardNotificationsActions";

type Props = {
  notifications: UserNotificationRow[];
};

function formatWeeksLabel(weeks: unknown): string {
  if (!Array.isArray(weeks) || weeks.length === 0) return "";
  const parsed = weeks
    .filter(
      (x): x is { year: number; week: number } =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as { year?: unknown }).year === "number" &&
        typeof (x as { week?: unknown }).week === "number"
    )
    .sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.week - b.week
    );
  if (parsed.length === 0) return "";
  const first = parsed[0]!;
  const last = parsed[parsed.length - 1]!;
  if (first.year === last.year && first.week === last.week) {
    return `${first.year} W${first.week}`;
  }
  if (first.year === last.year) {
    return `${first.year} W${first.week}–W${last.week}`;
  }
  return `${first.year} W${first.week} – ${last.year} W${last.week}`;
}

function notificationBody(n: UserNotificationRow): { text: ReactNode } {
  const p = n.payload;
  if (n.kind === USER_NOTIFICATION_KIND.ALLOCATION_BOOKED) {
    const customer =
      typeof p.customerName === "string" && p.customerName.trim()
        ? p.customerName.trim()
        : null;
    const project =
      typeof p.projectName === "string" && p.projectName.trim()
        ? p.projectName.trim()
        : null;
    const projectId =
      typeof p.projectId === "string" && p.projectId ? p.projectId : null;
    const weeksLabel = formatWeeksLabel(p.weeks);
    const who =
      customer && project
        ? `${customer} · ${project}`
        : project ?? customer ?? "a project";
    const text = (
      <>
        You have been booked on{" "}
        {projectId ? (
          <Link
            href={`/projects/${projectId}`}
            className="font-medium text-brand-signal hover:underline"
          >
            {who}
          </Link>
        ) : (
          <span className="font-medium">{who}</span>
        )}
        {weeksLabel ? <> ({weeksLabel})</> : null}.
      </>
    );
    return { text };
  }
  if (n.kind === USER_NOTIFICATION_KIND.FEATURE_REQUEST_IMPLEMENTED) {
    const preview =
      typeof p.contentPreview === "string" && p.contentPreview.trim()
        ? p.contentPreview.trim()
        : "(no content)";
    return {
      text: (
        <>
          A feature request you submitted has been marked as done:{" "}
          <span className="font-medium opacity-90">&quot;{preview}&quot;</span>
        </>
      ),
    };
  }
  return { text: n.kind };
}

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
      <ul className="space-y-2">
        {notifications.map((n) => {
          const unread = n.read_at == null;
          const { text } = notificationBody(n);
          return (
            <li
              key={n.id}
              className={`flex flex-col gap-2 rounded border border-form p-3 text-sm sm:flex-row sm:items-start sm:justify-between ${
                unread ? "border-l-2 border-l-brand-signal bg-bg-muted/40" : ""
              }`}
            >
              <div className="min-w-0 flex-1 text-text-primary">{text}</div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                <time
                  className="text-xs text-text-primary opacity-60"
                  dateTime={n.created_at}
                >
                  {new Date(n.created_at).toLocaleString("en-US", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </time>
                {unread && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => {
                        void markDashboardNotificationReadAction(n.id).then(
                          afterMarkRead
                        );
                      })
                    }
                  >
                    Mark as read
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
