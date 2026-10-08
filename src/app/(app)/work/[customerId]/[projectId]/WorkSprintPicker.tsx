"use client";

import { useEffect, useRef } from "react";
import type { WorkSprint } from "@/lib/workTypes";
import { workSprintLabel } from "@/lib/workSprintLabel";

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
  selectedIds = [],
  onChange,
  multi = false,
}: {
  sprints: WorkSprint[];
  selectedIds?: readonly string[];
  onChange: (ids: string[]) => void;
  /** When true, chips toggle independently (Board filter). */
  multi?: boolean;
}) {
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const selectedSet = new Set(selectedIds);
  const focusId = selectedIds[selectedIds.length - 1] ?? null;

  useEffect(() => {
    selectedRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [focusId]);

  if (sprints.length === 0) return null;

  function selectSprint(sprintId: string) {
    if (multi) {
      if (selectedSet.has(sprintId)) {
        onChange(selectedIds.filter((id) => id !== sprintId));
        return;
      }
      onChange([...selectedIds, sprintId]);
      return;
    }
    onChange([sprintId]);
  }

  return (
    <div
      role={multi ? "group" : "tablist"}
      aria-label={multi ? "Filter by sprint" : "Sprints"}
      className="-mx-0.5 flex min-w-0 gap-1.5 overflow-x-auto px-0.5 pb-0.5"
    >
      {sprints.map((sprint) => {
        const selected = selectedSet.has(sprint.id);
        const status = statusLabel(sprint.status);
        return (
          <button
            key={sprint.id}
            ref={sprint.id === focusId ? selectedRef : undefined}
            type="button"
            role={multi ? "checkbox" : "tab"}
            aria-checked={multi ? selected : undefined}
            aria-selected={multi ? undefined : selected}
            title={`${workSprintLabel(sprint)} · ${status} · ${sprint.startsOn} → ${sprint.endsOn}`}
            onClick={() => selectSprint(sprint.id)}
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
              {workSprintLabel(sprint)}
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
                {formatShortDate(sprint.startsOn)}–
                {formatShortDate(sprint.endsOn)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
