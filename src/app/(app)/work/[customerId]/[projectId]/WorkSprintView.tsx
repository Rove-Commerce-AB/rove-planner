"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
} from "react";
import { Button } from "@/components/ui";
import {
  closeWorkSprintAction,
  createWorkSprintAction,
  setWorkIssueSprintAction,
  updateWorkSprintAction,
} from "../../actions";
import type { WorkBoardView, WorkIssue, WorkSprint } from "@/lib/workTypes";
import { formatWorkHours } from "@/lib/workTime";
import { WorkSprintPicker } from "./WorkSprintPicker";

const DRAG_TYPE = "application/x-work-sprint-issue";

function sprintLabel(sprint: WorkSprint) {
  const base = `Sprint ${sprint.number}`;
  return sprint.title.trim() ? `${base} · ${sprint.title.trim()}` : base;
}

function sortSprints(sprints: WorkSprint[]) {
  return sprints.slice().sort((a, b) => a.number - b.number);
}

function issueEstimateSum(issues: WorkIssue[]) {
  return issues.reduce((sum, issue) => sum + (issue.estimateHours ?? 0), 0);
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function sprintLengthWeeks(sprint: WorkSprint) {
  const start = new Date(`${sprint.startsOn}T00:00:00.000Z`).getTime();
  const end = new Date(`${sprint.endsOn}T00:00:00.000Z`).getTime();
  const days = Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1);
  return Math.max(1, Math.round(days / 7));
}

const LENGTH_WEEK_PRESETS = [1, 2, 3, 4] as const;

export function WorkSprintView({
  board,
  issues,
  sprints,
  doneStatusIds,
  onIssuesChange,
  onSprintsChange,
  onOpenIssue,
  onError,
  onChanged,
}: {
  board: WorkBoardView;
  issues: WorkIssue[];
  sprints: WorkSprint[];
  doneStatusIds: Set<string>;
  onIssuesChange: (issues: WorkIssue[]) => void;
  onSprintsChange: (sprints: WorkSprint[]) => void;
  onOpenIssue: (issueId: string) => void;
  onError: (message: string) => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [closeOpen, setCloseOpen] = useState(false);
  const [planNextOpen, setPlanNextOpen] = useState(false);
  const [planLengthWeeks, setPlanLengthWeeks] = useState(2);
  const [capacityDraft, setCapacityDraft] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<"backlog" | "sprint" | null>(
    null
  );
  const draggingIdRef = useRef<string | null>(null);
  const skipClickRef = useRef(false);

  const orderedSprints = useMemo(() => sortSprints(sprints), [sprints]);
  const current = sprints.find((sprint) => sprint.status === "current") ?? null;
  const next = sprints.find((sprint) => sprint.status === "next") ?? null;

  useEffect(() => {
    if (orderedSprints.length === 0) {
      setViewingId(null);
      return;
    }
    setViewingId((prev) => {
      if (prev && orderedSprints.some((sprint) => sprint.id === prev)) {
        return prev;
      }
      return current?.id ?? orderedSprints[orderedSprints.length - 1]!.id;
    });
  }, [orderedSprints, current?.id]);

  const viewing =
    orderedSprints.find((sprint) => sprint.id === viewingId) ?? null;
  const isViewingCurrent = viewing?.status === "current";
  const canPlanScope =
    viewing?.status === "current" || viewing?.status === "next";

  const backlog = useMemo(
    () => issues.filter((issue) => issue.sprintId == null),
    [issues]
  );
  const viewingIssues = useMemo(
    () =>
      viewing ? issues.filter((issue) => issue.sprintId === viewing.id) : [],
    [issues, viewing]
  );
  const unfinished = viewingIssues.filter(
    (issue) => !doneStatusIds.has(issue.status)
  );
  const estimateSum = issueEstimateSum(viewingIssues);
  const overCapacity =
    viewing?.capacityHours != null && estimateSum > viewing.capacityHours;
  const capacityHours = viewing?.capacityHours ?? null;
  const capacityRatio =
    capacityHours != null && capacityHours > 0
      ? estimateSum / capacityHours
      : null;
  const capacityFillPct =
    capacityRatio == null ? 0 : Math.min(100, capacityRatio * 100);

  useEffect(() => {
    setCapacityDraft(
      viewing?.capacityHours == null ? "" : String(viewing.capacityHours)
    );
  }, [viewing?.id, viewing?.capacityHours]);

  function commitCapacity(rawValue: string) {
    if (!viewing || !canPlanScope) return;
    const raw = rawValue.trim();
    const value = raw === "" ? null : Number(raw);
    if (raw !== "" && (!Number.isFinite(value) || (value ?? 0) < 0)) {
      onError("Capacity must be a number of hours");
      return;
    }
    if (value === (viewing.capacityHours ?? null)) return;
    onSprintsChange(
      sprints.map((sprint) =>
        sprint.id === viewing.id ? { ...sprint, capacityHours: value } : sprint
      )
    );
    run(() =>
      updateWorkSprintAction(board.id, viewing.id, {
        capacityHours: value,
      })
    );
  }

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        onError(result.error);
        return;
      }
      onChanged();
    });
  }

  function moveIssue(issueId: string, sprintId: string | null) {
    const issue = issues.find((row) => row.id === issueId);
    if (!issue) return;
    if ((issue.sprintId ?? null) === sprintId) return;
    onIssuesChange(
      issues.map((row) =>
        row.id === issueId ? { ...row, sprintId } : row
      )
    );
    run(() => setWorkIssueSprintAction(board.id, issueId, sprintId));
  }

  function onDragStart(event: DragEvent, issueId: string) {
    if (!canPlanScope) {
      event.preventDefault();
      return;
    }
    draggingIdRef.current = issueId;
    skipClickRef.current = true;
    event.dataTransfer.setData(DRAG_TYPE, issueId);
    event.dataTransfer.setData("text/plain", issueId);
    event.dataTransfer.effectAllowed = "move";
  }

  function onDragEnd() {
    draggingIdRef.current = null;
    setDragOverTarget(null);
    window.setTimeout(() => {
      skipClickRef.current = false;
    }, 0);
  }

  function acceptDrop(event: DragEvent, target: "backlog" | "sprint") {
    if (!canPlanScope) return false;
    if (!draggingIdRef.current && !event.dataTransfer.types.includes(DRAG_TYPE)) {
      return false;
    }
    if (target === "sprint" && !viewing) return false;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverTarget(target);
    return true;
  }

  function handleDrop(event: DragEvent, target: "backlog" | "sprint") {
    event.preventDefault();
    if (!canPlanScope) return;
    const issueId =
      event.dataTransfer.getData(DRAG_TYPE) ||
      event.dataTransfer.getData("text/plain") ||
      draggingIdRef.current;
    setDragOverTarget(null);
    draggingIdRef.current = null;
    if (!issueId) return;
    if (target === "sprint") {
      if (!viewing) return;
      moveIssue(issueId, viewing.id);
      return;
    }
    moveIssue(issueId, null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {orderedSprints.length > 0 ? (
            <WorkSprintPicker
              sprints={orderedSprints}
              selectedId={viewing?.id ?? null}
              onSelect={setViewingId}
            />
          ) : (
            <>
              <h2 className="text-heading-s text-text-primary">No sprints yet</h2>
              <p className="text-sm text-text-secondary">
                Create a current sprint to plan scope.
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewing ? (
            <>
              <div
                className={`flex min-w-[11.5rem] flex-col gap-1.5 rounded-lg border px-3 py-2 ${
                  overCapacity
                    ? "border-danger/40 bg-danger/5"
                    : "border-border-subtle bg-bg-default"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={`text-[13px] tabular-nums ${
                      overCapacity ? "text-danger" : "text-text-primary"
                    }`}
                  >
                    {formatWorkHours(estimateSum)}
                    <span className="text-text-tertiary"> planned</span>
                  </span>
                  {canPlanScope ? (
                    <label className="flex items-center gap-1 text-[13px] text-text-secondary">
                      <span className="text-text-tertiary">of</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label="Sprint capacity in hours"
                        value={capacityDraft}
                        placeholder="—"
                        disabled={pending}
                        onChange={(event) => setCapacityDraft(event.target.value)}
                        onBlur={(event) => commitCapacity(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitCapacity(capacityDraft);
                            (event.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-9 border-0 border-b border-border-subtle bg-transparent p-0 text-right text-[13px] tabular-nums text-text-primary placeholder:text-text-muted focus:border-brand-signal focus:outline-none disabled:opacity-50"
                      />
                      <span className="text-text-tertiary">h</span>
                    </label>
                  ) : (
                    <span className="text-[13px] tabular-nums text-text-secondary">
                      {capacityHours != null
                        ? `of ${formatWorkHours(capacityHours)}`
                        : "no capacity"}
                    </span>
                  )}
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    capacityHours == null
                      ? undefined
                      : Math.round(capacityFillPct)
                  }
                  aria-label="Planned hours versus capacity"
                  title={
                    capacityHours == null
                      ? `${formatWorkHours(estimateSum)} planned · set capacity`
                      : `${formatWorkHours(estimateSum)} / ${formatWorkHours(capacityHours)}`
                  }
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-200 ${
                      overCapacity ? "bg-danger" : "bg-brand-signal"
                    }`}
                    style={{
                      width:
                        capacityHours == null ? "0%" : `${capacityFillPct}%`,
                    }}
                  />
                </div>
              </div>
              {isViewingCurrent ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => setCloseOpen(true)}
                >
                  Close sprint
                </Button>
              ) : null}
            </>
          ) : null}
          {!current ? (
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await createWorkSprintAction(board.id, {
                    as: "current",
                    lengthDays: 14,
                  });
                  if (!result.ok) return result;
                  onSprintsChange([result.sprint, ...sprints]);
                  setViewingId(result.sprint.id);
                  return { ok: true };
                })
              }
            >
              Start sprint
            </Button>
          ) : !next ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => {
                setPlanLengthWeeks(current ? sprintLengthWeeks(current) : 2);
                setPlanNextOpen(true);
              }}
            >
              Plan next
            </Button>
          ) : null}
          {current && viewing && !isViewingCurrent ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setViewingId(current.id)}
            >
              Go to current
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <SprintColumn
          title="Backlog"
          count={backlog.length}
          empty="No backlog issues."
          issues={backlog}
          pending={pending}
          dropActive={dragOverTarget === "backlog"}
          canDrop={canPlanScope}
          draggableCards={canPlanScope}
          onOpenIssue={(issueId) => {
            if (skipClickRef.current) return;
            onOpenIssue(issueId);
          }}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={(event) => acceptDrop(event, "backlog")}
          onDragLeave={() => setDragOverTarget(null)}
          onDrop={(event) => handleDrop(event, "backlog")}
        />
        <SprintColumn
          title={viewing ? sprintLabel(viewing) : "Sprint"}
          count={viewingIssues.length}
          empty={
            viewing
              ? canPlanScope
                ? "Drop issues here from the backlog."
                : "No issues in this sprint."
              : "Start a sprint first."
          }
          issues={viewingIssues}
          pending={pending || !canPlanScope}
          dropActive={dragOverTarget === "sprint"}
          canDrop={canPlanScope}
          draggableCards={canPlanScope}
          onOpenIssue={(issueId) => {
            if (skipClickRef.current) return;
            onOpenIssue(issueId);
          }}
          warnBlocked={canPlanScope ? unfinished : undefined}
          board={board}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={(event) => acceptDrop(event, "sprint")}
          onDragLeave={() => setDragOverTarget(null)}
          onDrop={(event) => handleDrop(event, "sprint")}
        />
      </div>

      {planNextOpen && current ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-bg-default p-5 shadow-lg">
            <h3 className="text-heading-s text-text-primary">Plan next sprint</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Starts {addDays(current.endsOn, 1)}. How many weeks?
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {LENGTH_WEEK_PRESETS.map((weeks) => (
                <button
                  key={weeks}
                  type="button"
                  className={`rounded-md border px-2.5 py-1.5 text-[13px] transition-colors ${
                    planLengthWeeks === weeks
                      ? "border-accent-primary bg-accent-primary-subtle text-accent-primary-text"
                      : "border-border-subtle text-text-secondary hover:bg-bg-muted hover:text-text-primary"
                  }`}
                  onClick={() => setPlanLengthWeeks(weeks)}
                >
                  {weeks} {weeks === 1 ? "week" : "weeks"}
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
              <span>Custom</span>
              <input
                type="number"
                min={1}
                max={12}
                value={planLengthWeeks}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!Number.isFinite(value)) return;
                  setPlanLengthWeeks(Math.max(1, Math.min(12, Math.round(value))));
                }}
                className="w-16 rounded-md border border-border-subtle bg-bg-default px-2 py-1 text-sm tabular-nums text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-signal"
              />
              <span className="text-text-tertiary">
                {planLengthWeeks === 1 ? "week" : "weeks"}
              </span>
            </label>
            <p className="mt-2 text-caption text-text-tertiary">
              {addDays(current.endsOn, 1)} →{" "}
              {addDays(current.endsOn, planLengthWeeks * 7)}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => setPlanNextOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending || planLengthWeeks < 1}
                onClick={() => {
                  setPlanNextOpen(false);
                  run(async () => {
                    const result = await createWorkSprintAction(board.id, {
                      as: "next",
                      startsOn: addDays(current.endsOn, 1),
                      lengthDays: planLengthWeeks * 7,
                    });
                    if (!result.ok) return result;
                    onSprintsChange([...sprints, result.sprint]);
                    setViewingId(result.sprint.id);
                    return { ok: true };
                  });
                }}
              >
                Create sprint
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {closeOpen && current && isViewingCurrent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-bg-default p-5 shadow-lg">
            <h3 className="text-heading-s text-text-primary">Close sprint</h3>
            <p className="mt-1 text-sm text-text-secondary">
              {unfinished.length > 0
                ? `${unfinished.length} unfinished issue${
                    unfinished.length === 1 ? "" : "s"
                  }. Where should they go?`
                : "All sprint issues are done. Close this sprint?"}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {unfinished.length > 0 ? (
                <>
                  <Button
                    type="button"
                    disabled={pending || !next}
                    onClick={() => {
                      setCloseOpen(false);
                      run(() =>
                        closeWorkSprintAction(board.id, current.id, "next")
                      );
                    }}
                  >
                    Move to next sprint
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      setCloseOpen(false);
                      run(() =>
                        closeWorkSprintAction(board.id, current.id, "backlog")
                      );
                    }}
                  >
                    Move to backlog
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      setCloseOpen(false);
                      run(() =>
                        closeWorkSprintAction(board.id, current.id, "leave")
                      );
                    }}
                  >
                    Leave in this sprint
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setCloseOpen(false);
                    run(() =>
                      closeWorkSprintAction(board.id, current.id, "leave")
                    );
                  }}
                >
                  Close sprint
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setCloseOpen(false)}
              >
                Cancel
              </Button>
            </div>
            {unfinished.length > 0 && !next ? (
              <p className="mt-3 text-caption text-text-tertiary">
                Create a next sprint to enable “Move to next”.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SprintColumn({
  title,
  count,
  empty,
  issues,
  pending,
  dropActive,
  canDrop,
  draggableCards,
  onOpenIssue,
  warnBlocked,
  board,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  title: string;
  count: number;
  empty: string;
  issues: WorkIssue[];
  pending: boolean;
  dropActive: boolean;
  canDrop: boolean;
  draggableCards: boolean;
  onOpenIssue: (issueId: string) => void;
  warnBlocked?: WorkIssue[];
  board?: WorkBoardView;
  onDragStart: (event: DragEvent, issueId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent) => boolean;
  onDragLeave: () => void;
  onDrop: (event: DragEvent) => void;
}) {
  const blockedIds = useMemo(() => {
    if (!warnBlocked || !board) return new Set<string>();
    const ids = new Set<string>();
    for (const issue of warnBlocked) {
      for (const blocker of issue.relations.blockedBy) {
        const other = board.issues.find((row) => row.id === blocker.id);
        if (!other) continue;
        if (other.sprintId !== issue.sprintId) {
          ids.add(issue.id);
        }
        const done = board.statuses.find((s) => s.id === other.status)?.isDone;
        if (!done) ids.add(issue.id);
      }
    }
    return ids;
  }, [warnBlocked, board]);

  return (
    <section
      className={`flex min-h-0 flex-col rounded-xl border bg-bg-muted/40 transition-colors ${
        dropActive
          ? "border-brand-signal bg-accent-primary-subtle/40"
          : "border-border-subtle"
      }`}
      onDragOver={(event) => {
        if (!canDrop) return;
        onDragOver(event);
      }}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        if (!canDrop) return;
        onDrop(event);
      }}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        <span className="tabular-nums text-caption text-text-tertiary">
          {count}
        </span>
      </header>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {issues.length === 0 ? (
          <li className="px-2 py-6 text-center text-sm text-text-tertiary">
            {empty}
          </li>
        ) : (
          issues.map((issue) => (
            <li
              key={issue.id}
              draggable={draggableCards && !pending}
              onDragStart={(event) => onDragStart(event, issue.id)}
              onDragEnd={onDragEnd}
              className={`rounded-lg border border-border-subtle bg-bg-default px-2.5 py-2 ${
                draggableCards
                  ? "cursor-grab active:cursor-grabbing"
                  : "cursor-default"
              }`}
            >
              <button
                type="button"
                className="w-full min-w-0 text-left"
                onClick={() => onOpenIssue(issue.id)}
              >
                <p className="flex min-w-0 items-baseline gap-2 text-sm text-text-primary">
                  <span className="shrink-0 text-label-s tabular-nums text-text-tertiary">
                    {issue.key}
                  </span>
                  <span className="min-w-0 truncate">{issue.title}</span>
                </p>
                {blockedIds.has(issue.id) ? (
                  <p className="text-caption text-danger">
                    Blocked by work outside this sprint or not done
                  </p>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
