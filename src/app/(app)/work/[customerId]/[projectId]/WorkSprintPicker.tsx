"use client";

import { useEffect, useRef } from "react";
import type { WorkSprint } from "@/lib/workTypes";

function sprintName(sprint: WorkSprint) {
  return sprint.title.trim()
    ? `Sprint ${sprint.number} · ${sprint.title.trim()}`
    : `Sprint ${sprint.number}`;
}

function statusLabel(status: WorkSprint["status"]) {
  if (status === "current") return "Current";
  if (status === "next") return "Next";
  return "Completed";
}

function formatShortDate(iso: string) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function WorkSprintPicker({
  sprints,
  selectedId,
  onSelect,
}: {
  sprints: WorkSprint[];
  selectedId: string | null;
  onSelect: (sprintId: string) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [selectedId]);

  if (sprints.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="Sprints"
      className="-mx-0.5 flex min-w-0 gap-1.5 overflow-x-auto px-0.5 pb-0.5"
    >
      {sprints.map((sprint) => {
        const selected = sprint.id === selectedId;
        const status = statusLabel(sprint.status);
        return (
          <button
            key={sprint.id}
            ref={selected ? selectedRef : undefined}
            type="button"
            role="tab"
            aria-selected={selected}
            title={`${sprintName(sprint)} · ${status} · ${sprint.startsOn} → ${sprint.endsOn}`}
            onClick={() => onSelect(sprint.id)}
            className={`flex min-w-[7.5rem] shrink-0 flex-col items-start gap-0.5 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
              selected
                ? "border-accent-primary bg-accent-primary-subtle"
                : "border-border-subtle bg-bg-default hover:bg-bg-muted"
            }`}
          >
            <span
              className={`max-w-[10rem] truncate text-[13px] font-medium ${
                selected ? "text-accent-primary-text" : "text-text-primary"
              }`}
            >
              {sprintName(sprint)}
            </span>
            <span className="flex w-full items-center justify-between gap-2">
              <span
                className={`text-caption ${
                  sprint.status === "current"
                    ? selected
                      ? "text-accent-primary-text"
                      : "text-text-primary"
                    : sprint.status === "next"
                      ? "text-text-secondary"
                      : "text-text-tertiary"
                }`}
              >
                {status}
              </span>
              <span className="text-caption tabular-nums text-text-tertiary">
                {formatShortDate(sprint.startsOn)}–{formatShortDate(sprint.endsOn)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
