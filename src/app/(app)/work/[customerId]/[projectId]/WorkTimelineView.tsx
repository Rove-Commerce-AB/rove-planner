"use client";

import { useMemo, useRef, useState, useTransition, type PointerEvent } from "react";
import { updateWorkIssueScheduleAction } from "../../actions";
import type { WorkBoardView, WorkIssue, WorkSprint } from "@/lib/workTypes";
import { workStatusDotClass } from "@/lib/workStatuses";
import { WorkSprintPicker } from "./WorkSprintPicker";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const ROW_H = 36;
const LABEL_W = 220;

function sprintLabel(sprint: WorkSprint) {
  return sprint.title.trim()
    ? `Sprint ${sprint.number} · ${sprint.title.trim()}`
    : `Sprint ${sprint.number}`;
}

function sortSprints(sprints: WorkSprint[]) {
  return sprints.slice().sort((a, b) => a.number - b.number);
}

function parseDay(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).getTime();
}

function formatDay(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number) {
  return formatDay(parseDay(iso) + days * DAY_MS);
}

function issueBarRange(issue: WorkIssue, sprints: WorkSprint[]) {
  if (issue.startDate && issue.dueDate) {
    return { start: issue.startDate, end: issue.dueDate };
  }
  if (issue.startDate) {
    return { start: issue.startDate, end: issue.startDate };
  }
  if (issue.dueDate) {
    return { start: issue.dueDate, end: issue.dueDate };
  }
  const sprint = sprints.find((row) => row.id === issue.sprintId);
  if (sprint) return { start: sprint.startsOn, end: sprint.endsOn };
  return null;
}

export function WorkTimelineView({
  board,
  issues,
  sprints,
  onIssuesChange,
  onOpenIssue,
  onError,
  onChanged,
}: {
  board: WorkBoardView;
  issues: WorkIssue[];
  sprints: WorkSprint[];
  onIssuesChange: (issues: WorkIssue[]) => void;
  onOpenIssue: (issueId: string) => void;
  onError: (message: string) => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [dayShift, setDayShift] = useState(0);
  const [panning, setPanning] = useState(false);
  const [focusedSprintId, setFocusedSprintId] = useState<string | null>(null);
  const dragRef = useRef<{
    issueId: string;
    mode: "move" | "start" | "end";
    originX: number;
    start: string;
    end: string;
  } | null>(null);
  const panRef = useRef<{
    pointerId: number;
    originX: number;
    originShift: number;
  } | null>(null);

  const orderedSprints = useMemo(() => sortSprints(sprints), [sprints]);
  const current = sprints.find((sprint) => sprint.status === "current") ?? null;
  const focusedSprint =
    orderedSprints.find((sprint) => sprint.id === focusedSprintId) ??
    current ??
    orderedSprints[orderedSprints.length - 1] ??
    null;

  const visibleIssues = useMemo(() => {
    const parents = new Map<string, WorkIssue[]>();
    const roots: WorkIssue[] = [];
    for (const issue of issues) {
      const parent = issue.relations.parent;
      if (parent && issues.some((row) => row.id === parent.id)) {
        const list = parents.get(parent.id) ?? [];
        list.push(issue);
        parents.set(parent.id, list);
      } else {
        roots.push(issue);
      }
    }
    const ordered: { issue: WorkIssue; depth: number }[] = [];
    function walk(issue: WorkIssue, depth: number) {
      ordered.push({ issue, depth });
      for (const child of parents.get(issue.id) ?? []) {
        walk(child, depth + 1);
      }
    }
    for (const root of roots) walk(root, 0);
    return ordered;
  }, [issues]);

  const baseRange = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const anchor = startOfWeekMondayUtc(
      parseDay(focusedSprint?.startsOn ?? current?.startsOn ?? today)
    );
    return {
      startMs: anchor,
      endMs: anchor + 10 * WEEK_MS - DAY_MS,
    };
  }, [focusedSprint?.startsOn, current?.startsOn]);

  const range = useMemo(
    () => ({
      startMs: baseRange.startMs + dayShift * DAY_MS,
      endMs: baseRange.endMs + dayShift * DAY_MS,
    }),
    [baseRange, dayShift]
  );

  function goToSprint(sprint: WorkSprint) {
    setFocusedSprintId(sprint.id);
    setDayShift(0);
  }

  function onHeaderPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originShift: dayShift,
    };
    setPanning(true);
  }

  function onHeaderPointerMove(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const deltaDays = Math.round((pan.originX - event.clientX) / pxPerDay);
    setDayShift(pan.originShift + deltaDays);
  }

  function onHeaderPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    setPanning(false);
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  }

  const dayCount = Math.max(
    1,
    Math.round((range.endMs - range.startMs) / DAY_MS) + 1
  );
  const pxPerDay = Math.max(18, Math.min(36, 900 / dayCount));
  const chartW = dayCount * pxPerDay;
  const todayMs = parseDay(new Date().toISOString().slice(0, 10));

  function xFor(iso: string) {
    return ((parseDay(iso) - range.startMs) / DAY_MS) * pxPerDay;
  }

  function widthFor(start: string, end: string) {
    return Math.max(pxPerDay, ((parseDay(end) - parseDay(start)) / DAY_MS + 1) * pxPerDay);
  }

  function persistSchedule(issueId: string, start: string, end: string) {
    onIssuesChange(
      issues.map((issue) =>
        issue.id === issueId
          ? { ...issue, startDate: start, dueDate: end }
          : issue
      )
    );
    startTransition(async () => {
      const result = await updateWorkIssueScheduleAction(
        board.id,
        issueId,
        start,
        end
      );
      if (!result.ok) {
        onError(result.error);
        return;
      }
      onChanged();
    });
  }

  function onBarPointerDown(
    event: PointerEvent,
    issue: WorkIssue,
    mode: "move" | "start" | "end",
    start: string,
    end: string
  ) {
    if (pending) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragRef.current = {
      issueId: issue.id,
      mode,
      originX: event.clientX,
      start,
      end,
    };
  }

  function onBarPointerMove(event: PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaDays = Math.round((event.clientX - drag.originX) / pxPerDay);
    let start = drag.start;
    let end = drag.end;
    if (drag.mode === "move") {
      start = addDaysIso(drag.start, deltaDays);
      end = addDaysIso(drag.end, deltaDays);
    } else if (drag.mode === "start") {
      start = addDaysIso(drag.start, deltaDays);
      if (parseDay(start) > parseDay(end)) start = end;
    } else {
      end = addDaysIso(drag.end, deltaDays);
      if (parseDay(end) < parseDay(start)) end = start;
    }
    onIssuesChange(
      issues.map((issue) =>
        issue.id === drag.issueId
          ? { ...issue, startDate: start, dueDate: end }
          : issue
      )
    );
  }

  function onBarPointerUp(event: PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    const issue = issues.find((row) => row.id === drag.issueId);
    if (!issue?.startDate || !issue.dueDate) return;
    if (issue.startDate === drag.start && issue.dueDate === drag.end) return;
    persistSchedule(issue.id, issue.startDate, issue.dueDate);
  }

  const monthBands = useMemo(() => {
    const bands: { key: string; label: string; left: number; width: number }[] =
      [];
    let cursor = startOfMonthUtc(range.startMs);
    while (cursor <= range.endMs) {
      const next = addMonthsUtc(cursor, 1);
      const leftMs = Math.max(cursor, range.startMs);
      const rightMs = Math.min(next - DAY_MS, range.endMs);
      if (rightMs >= leftMs) {
        bands.push({
          key: formatDay(cursor),
          label: monthLabel(cursor),
          left: ((leftMs - range.startMs) / DAY_MS) * pxPerDay,
          width: ((rightMs - leftMs) / DAY_MS + 1) * pxPerDay,
        });
      }
      cursor = next;
    }
    return bands;
  }, [range.startMs, range.endMs, pxPerDay]);

  const weekStarts = useMemo(() => {
    const days: number[] = [];
    let cursor = startOfWeekMondayUtc(range.startMs);
    if (cursor < range.startMs) cursor += 7 * DAY_MS;
    while (cursor <= range.endMs) {
      days.push(cursor);
      cursor += 7 * DAY_MS;
    }
    return days;
  }, [range.startMs, range.endMs]);

  const monthStarts = useMemo(() => {
    const days: number[] = [];
    let cursor = startOfMonthUtc(range.startMs);
    if (cursor < range.startMs) cursor = addMonthsUtc(cursor, 1);
    while (cursor <= range.endMs) {
      days.push(cursor);
      cursor = addMonthsUtc(cursor, 1);
    }
    return days;
  }, [range.startMs, range.endMs]);

  const headerH = 52;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex flex-col gap-2">
        {orderedSprints.length > 0 ? (
          <WorkSprintPicker
            sprints={orderedSprints}
            selectedId={focusedSprint?.id ?? null}
            onSelect={(sprintId) => {
              const sprint = orderedSprints.find((row) => row.id === sprintId);
              if (sprint) goToSprint(sprint);
            }}
          />
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border-subtle">
        <div
          className="relative"
          style={{
            minWidth: LABEL_W + chartW,
            minHeight: headerH + Math.max(1, visibleIssues.length) * ROW_H,
          }}
        >
          <div
            className="sticky top-0 z-20 flex border-b border-border-subtle bg-bg-default"
            style={{ height: headerH }}
          >
            <div
              className="sticky left-0 z-30 flex shrink-0 items-end border-r border-border-subtle bg-bg-default px-3 pb-2 text-label-s text-text-secondary"
              style={{ width: LABEL_W }}
            >
              Issue
            </div>
            <div
              className={`relative touch-none select-none ${
                panning ? "cursor-grabbing" : "cursor-grab"
              }`}
              style={{ width: chartW, height: headerH }}
              title="Drag to pan timeline"
              onPointerDown={onHeaderPointerDown}
              onPointerMove={onHeaderPointerMove}
              onPointerUp={onHeaderPointerUp}
              onPointerCancel={onHeaderPointerUp}
            >
              {monthBands.map((band) => (
                <div
                  key={band.key}
                  className="absolute top-0 flex h-6 items-center border-r border-[var(--color-border-default)] px-1.5 text-[11px] font-medium uppercase tracking-wide text-text-secondary"
                  style={{ left: band.left, width: band.width }}
                >
                  <span className="truncate">{band.label}</span>
                </div>
              ))}
              {weekStarts.map((ms) => (
                <span
                  key={ms}
                  className="absolute bottom-1.5 text-[10px] font-medium tabular-nums text-text-secondary"
                  style={{ left: ((ms - range.startMs) / DAY_MS) * pxPerDay + 3 }}
                  title={weekTickTitle(ms)}
                >
                  {weekTickLabel(ms)}
                </span>
              ))}
              {weekStarts.map((ms) => (
                <div
                  key={`hw-${ms}`}
                  className="absolute bottom-0 top-6 w-px bg-border-subtle"
                  style={{ left: ((ms - range.startMs) / DAY_MS) * pxPerDay }}
                />
              ))}
              {monthStarts.map((ms) => (
                <div
                  key={`hm-${ms}`}
                  className="absolute inset-y-0 w-px bg-[var(--color-border-strong)]"
                  style={{ left: ((ms - range.startMs) / DAY_MS) * pxPerDay }}
                />
              ))}
            </div>
          </div>

          <div
            className="pointer-events-none absolute bottom-0"
            style={{ top: headerH, left: LABEL_W, width: chartW }}
          >
            {weekStarts.map((ms) => (
              <div
                key={`gw-${ms}`}
                className="absolute inset-y-0 w-px bg-border-subtle"
                style={{ left: ((ms - range.startMs) / DAY_MS) * pxPerDay }}
              />
            ))}
            {monthStarts.map((ms) => (
              <div
                key={`gm-${ms}`}
                className="absolute inset-y-0 w-px bg-[var(--color-border-strong)]"
                style={{ left: ((ms - range.startMs) / DAY_MS) * pxPerDay }}
              />
            ))}
            {sprints.map((sprint) => {
              const left = xFor(sprint.startsOn);
              const width = widthFor(sprint.startsOn, sprint.endsOn);
              return (
                <div
                  key={sprint.id}
                  className={`absolute inset-y-0 border-x ${
                    sprint.status === "current"
                      ? "bg-interactive-primary/8 border-interactive-primary/30"
                      : sprint.status === "next"
                        ? "bg-bg-muted/80 border-border-subtle"
                        : "bg-transparent border-border-subtle/60"
                  }`}
                  style={{ left, width }}
                  title={sprintLabel(sprint)}
                />
              );
            })}
            {todayMs >= range.startMs && todayMs <= range.endMs ? (
              <div
                className="absolute inset-y-0 z-[1] w-0.5 bg-danger/80"
                style={{ left: ((todayMs - range.startMs) / DAY_MS) * pxPerDay }}
              />
            ) : null}
          </div>

          {visibleIssues.map(({ issue, depth }) => {
            const bar = issueBarRange(issue, sprints);
            const statusIndex = board.statuses.findIndex(
              (status) => status.id === issue.status
            );
            const sprint = sprints.find((row) => row.id === issue.sprintId);
            const overflow =
              bar &&
              sprint &&
              (parseDay(bar.start) < parseDay(sprint.startsOn) ||
                parseDay(bar.end) > parseDay(sprint.endsOn));
            return (
              <div
                key={issue.id}
                className="relative flex border-b border-border-subtle/70"
                style={{ height: ROW_H }}
              >
                <button
                  type="button"
                  className="sticky left-0 z-10 flex shrink-0 items-center gap-2 truncate border-r border-border-subtle bg-bg-default px-3 text-left text-xs text-text-primary hover:bg-bg-muted"
                  style={{ width: LABEL_W, paddingLeft: 12 + depth * 12 }}
                  onClick={() => onOpenIssue(issue.id)}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${workStatusDotClass(statusIndex)}`}
                    aria-hidden
                  />
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 text-label-s tabular-nums text-text-tertiary">
                      {issue.key}
                    </span>
                    <span className="min-w-0 truncate">{issue.title}</span>
                  </span>
                </button>
                <div className="relative" style={{ width: chartW, height: ROW_H }}>
                  {bar ? (
                    <div
                      className={`absolute top-2 z-[1] h-5 rounded-md ${
                        overflow
                          ? "bg-danger/80"
                          : "bg-interactive-primary"
                      } ${pending ? "opacity-70" : ""}`}
                      style={{
                        left: xFor(bar.start),
                        width: widthFor(bar.start, bar.end),
                      }}
                      onPointerDown={(event) =>
                        onBarPointerDown(event, issue, "move", bar.start, bar.end)
                      }
                      onPointerMove={onBarPointerMove}
                      onPointerUp={onBarPointerUp}
                      title={`${bar.start} → ${bar.end}${
                        overflow ? " (outside sprint)" : ""
                      }`}
                    >
                      <span
                        className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize rounded-l-md bg-black/20"
                        onPointerDown={(event) =>
                          onBarPointerDown(
                            event,
                            issue,
                            "start",
                            bar.start,
                            bar.end
                          )
                        }
                      />
                      <span
                        className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize rounded-r-md bg-black/20"
                        onPointerDown={(event) =>
                          onBarPointerDown(
                            event,
                            issue,
                            "end",
                            bar.start,
                            bar.end
                          )
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function startOfWeekMondayUtc(ms: number) {
  const date = new Date(ms);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + diff
  );
}

function startOfMonthUtc(ms: number) {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function addMonthsUtc(ms: number, months: number) {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1);
}

function monthLabel(ms: number) {
  return new Date(ms).toLocaleString("sv-SE", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function isoWeekNumber(ms: number) {
  const date = new Date(ms);
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

function weekTickLabel(ms: number) {
  return `W${isoWeekNumber(ms)}`;
}

function weekTickTitle(ms: number) {
  const date = new Date(ms);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `Week ${isoWeekNumber(ms)} · starts ${day}/${month}`;
}
