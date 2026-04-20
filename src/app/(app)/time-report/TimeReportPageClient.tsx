"use client";

import { useState, useCallback, useEffect, useRef, Fragment, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Trash2,
  X,
  Copy,
  CopyPlus,
  Link,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  getActiveProjectsForCustomer,
  getJiraDevOpsOptionsForProject,
  getTaskOptionsForCustomerAndProject,
  getHolidayDatesForWeek,
  getHolidayDatesForRange,
  getTimeReportEntries,
  saveTimeReportEntries,
  copyEntryToWeek,
  batchHydrateTimeReport,
} from "./actions";
import type { ProjectOption, JiraDevOpsOption, TaskOption } from "@/types";
import { Button, Select, Combobox, Dialog, IconButton } from "@/components/ui";
import {
  getISOWeekDateRangeLocal,
  addWeeksToYearWeekLocal,
  getWeeksInMonthLocal,
  getWeekDates,
  getCalendarDatesInMonth,
} from "@/lib/timeReportBrowserWeek";
import {
  TIME_REPORT_DAY_LABELS,
  TIME_REPORT_MONTH_GRID_DOW,
} from "./timeReportShared";
import {
  type TimeReportEntry as Entry,
  type TimeReportCustomerGroup as CustomerGroup,
  newTimeReportEntry as newEntry,
  timeReportEntryHasContent as entryHasContent,
  timeReportTaskCacheKey as taskCacheKey,
  timeReportGroupTotalHours as groupTotalHours,
  timeReportDayTotals as dayTotals,
} from "./timeReportEntryModel";
import { TimeReportHourCell } from "./TimeReportHourCell";

const ENABLE_PERF_DEBUG = process.env.NEXT_PUBLIC_DEBUG_PERF === "1";

function collectTimeReportHydratePayload(groups: CustomerGroup[]): {
  customerIds: string[];
  taskOptionPairs: Array<{ customerId: string; projectId: string }>;
} {
  const customerIds = [...new Set(groups.map((g) => g.customerId))];
  const pairSeen = new Set<string>();
  const taskOptionPairs: Array<{ customerId: string; projectId: string }> = [];
  for (const g of groups) {
    for (const e of g.entries) {
      const k = `${g.customerId}|${e.projectId || ""}`;
      if (pairSeen.has(k)) continue;
      pairSeen.add(k);
      taskOptionPairs.push({
        customerId: g.customerId,
        projectId: e.projectId || "",
      });
    }
  }
  return { customerIds, taskOptionPairs };
}

function weekSliceKey(year: number, week: number) {
  return `${year}-W${week}`;
}

/** Native `title` on the Jira/DevOps key: shows summary/title when loaded. */
function jiraDevOpsKeyTooltipTitle(
  displayKey: string,
  description?: string | null
): string {
  const d = description?.trim();
  return d ? `${displayKey} — ${d}` : `${displayKey} — Change Jira/DevOps`;
}

/** One logical time row in month view (may span multiple ISO weeks after merge). */
type MonthMergedRow = {
  id: string;
  customerId: string;
  projectId: string;
  roleId: string;
  jiraDevOpsValue: string;
  task: string;
  hoursByDate: Record<string, number>;
  commentsByDate: Record<string, string>;
};

function commentSignatureForMerge(
  entry: Entry,
  weekDates: string[],
  monthCalendarDates: string[]
): string {
  return monthCalendarDates
    .map((d) => {
      const i = weekDates.indexOf(d);
      const c = i >= 0 ? (entry.comments[i] ?? "").trim() : "";
      return `${d}\x01${c}`;
    })
    .join("\x02");
}

function buildMergedMonthRows(
  slices: Record<string, CustomerGroup[]>,
  monthWeeks: { year: number; week: number }[],
  monthCalendarDates: string[]
): MonthMergedRow[] {
  type Source = {
    mergeKey: string;
    customerId: string;
    entry: Entry;
    hoursByDate: Record<string, number>;
    commentsByDate: Record<string, string>;
  };
  const monthSet = new Set(monthCalendarDates);
  const sources: Source[] = [];

  for (const { year: y, week: w } of monthWeeks) {
    const weekDates = getWeekDates(y, w);
    const groups = slices[weekSliceKey(y, w)] ?? [];
    for (const g of groups) {
      for (const e of g.entries) {
        const hoursByDate: Record<string, number> = {};
        const commentsByDate: Record<string, string> = {};
        for (let i = 0; i < 7; i++) {
          const d = weekDates[i]!;
          if (!monthSet.has(d)) continue;
          hoursByDate[d] = e.hours[i] ?? 0;
          const c = (e.comments[i] ?? "").trim();
          if (c) commentsByDate[d] = e.comments[i] ?? "";
        }
        const cSig = commentSignatureForMerge(e, weekDates, monthCalendarDates);
        const mergeKey = `${g.customerId}|${e.projectId}|${e.roleId}|${e.jiraDevOpsValue ?? ""}|${(e.task ?? "").trim()}|${cSig}`;
        sources.push({ mergeKey, customerId: g.customerId, entry: e, hoursByDate, commentsByDate });
      }
    }
  }

  const byKey = new Map<string, Source[]>();
  const keyOrder: string[] = [];
  for (const s of sources) {
    if (!byKey.has(s.mergeKey)) {
      byKey.set(s.mergeKey, []);
      keyOrder.push(s.mergeKey);
    }
    byKey.get(s.mergeKey)!.push(s);
  }

  const rows: MonthMergedRow[] = [];
  for (const mk of keyOrder) {
    const list = byKey.get(mk)!;
    const first = list[0]!;
    const hoursByDate: Record<string, number> = {};
    const commentsByDate: Record<string, string> = {};
    for (const d of monthCalendarDates) {
      hoursByDate[d] = 0;
      commentsByDate[d] = "";
    }
    for (const s of list) {
      for (const d of monthCalendarDates) {
        hoursByDate[d] = (hoursByDate[d] ?? 0) + (s.hoursByDate[d] ?? 0);
        const t = (s.commentsByDate[d] ?? "").trim();
        if (t) commentsByDate[d] = t;
      }
    }
    rows.push({
      id: crypto.randomUUID(),
      customerId: first.customerId,
      projectId: first.entry.projectId,
      roleId: first.entry.roleId,
      jiraDevOpsValue: first.entry.jiraDevOpsValue,
      task: first.entry.task ?? "",
      hoursByDate,
      commentsByDate,
    });
  }
  return rows;
}

function newMonthMergedRow(customerId: string, monthCalendarDates: string[]): MonthMergedRow {
  const hoursByDate: Record<string, number> = {};
  const commentsByDate: Record<string, string> = {};
  for (const d of monthCalendarDates) {
    hoursByDate[d] = 0;
    commentsByDate[d] = "";
  }
  return {
    id: crypto.randomUUID(),
    customerId,
    projectId: "",
    roleId: "",
    jiraDevOpsValue: "",
    task: "",
    hoursByDate,
    commentsByDate,
  };
}

function pseudoCustomerGroupsForHydrate(rows: MonthMergedRow[]): CustomerGroup[] {
  const byCustomer = new Map<string, Entry[]>();
  const order: string[] = [];
  for (const row of rows) {
    if (!byCustomer.has(row.customerId)) {
      byCustomer.set(row.customerId, []);
      order.push(row.customerId);
    }
    byCustomer.get(row.customerId)!.push({
      id: row.id,
      projectId: row.projectId,
      roleId: row.roleId,
      jiraDevOpsValue: row.jiraDevOpsValue,
      task: row.task,
      hours: [0, 0, 0, 0, 0, 0, 0],
      comments: {},
    });
  }
  return order.map((cid) => ({ customerId: cid, entries: byCustomer.get(cid)! }));
}

function buildCustomerGroupsForWeekFromMerged(
  rows: MonthMergedRow[],
  y: number,
  w: number
): CustomerGroup[] {
  const weekDates = getWeekDates(y, w);
  const order: string[] = [];
  const byCustomer = new Map<string, Entry[]>();
  for (const row of rows) {
    if (!byCustomer.has(row.customerId)) {
      byCustomer.set(row.customerId, []);
      order.push(row.customerId);
    }
    const hours = weekDates.map((d) => row.hoursByDate[d] ?? 0);
    const comments: Record<number, string> = {};
    weekDates.forEach((d, i) => {
      const t = (row.commentsByDate[d] ?? "").trim();
      if (t) comments[i] = row.commentsByDate[d] ?? "";
    });
    byCustomer.get(row.customerId)!.push({
      id: row.id,
      projectId: row.projectId,
      roleId: row.roleId,
      jiraDevOpsValue: row.jiraDevOpsValue,
      task: row.task,
      hours,
      comments,
    });
  }
  return order.map((cid) => ({ customerId: cid, entries: byCustomer.get(cid)! }));
}

function mergedRowHasContent(row: MonthMergedRow): boolean {
  const hasHours = Object.values(row.hoursByDate).some((h) => (h ?? 0) > 0);
  const hasComment = Object.values(row.commentsByDate).some((c) => (c ?? "").trim() !== "");
  return hasHours || hasComment;
}

/** Same calendar day-of-month in another (year, month), clamped to last day of target month. */
function mapDateSameDomToMonth(
  sourceYmd: string,
  targetYear: number,
  targetMonth: number
): string {
  const d0 = new Date(sourceYmd + "T12:00:00");
  const dom = d0.getDate();
  const last = new Date(targetYear, targetMonth, 0).getDate();
  const day = Math.min(dom, last);
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nextCalendarMonth(year: number, month: number): { y: number; m: number } {
  if (month === 12) return { y: year + 1, m: 1 };
  return { y: year, m: month + 1 };
}

type CustomerOption = { id: string; name: string; color?: string | null };

type Props = {
  consultant: { id: string; name: string; calendar_id?: string } | null;
  customers: CustomerOption[];
  initialYear: number;
  initialWeek: number;
  calendarId: string | null;
  initialHolidayDates: string[];
};

type EditableHourTdProps = {
  dayIndex: number;
  entryId: string;
  value: number;
  isEditing: boolean;
  isGray: boolean;
  /** Sat–Sun (month: lör–sön): slightly stronger mute than weekday public holidays. */
  grayWeekend?: boolean;
  isToday: boolean;
  onStartEdit: () => void;
  onCommit: (value: number) => void;
  onBlur: () => void;
  compact?: boolean;
  /** When set, overrides default `dayIndex === 0` for left border (month grid). */
  showLeftBorder?: boolean;
};

const EditableHourTd = memo(function EditableHourTd({
  dayIndex,
  entryId,
  value,
  isEditing,
  isGray,
  grayWeekend = false,
  isToday,
  onStartEdit,
  onCommit,
  onBlur,
  compact = false,
  showLeftBorder,
}: EditableHourTdProps) {
  const leftBorder = showLeftBorder ?? (dayIndex === 0 && !compact);
  const cellW = compact
    ? "min-w-0 w-full max-w-none"
    : "w-[3rem] min-w-[3rem]";
  const rowH = compact ? "h-7" : "h-8";
  const grayBg = isGray ? (grayWeekend ? "bg-bg-muted/60" : "bg-bg-muted/51") : "";
  return (
    <td
      className={`relative ${rowH} ${cellW} border-r border-border-subtle p-0 align-middle ${leftBorder ? "border-l border-border-subtle" : ""} ${grayBg} ${isToday ? "bg-brand-blue/32" : ""}`}
    >
      <div
        role="button"
        tabIndex={isEditing ? -1 : 0}
        onFocus={() => {
          if (!isEditing) onStartEdit();
        }}
        onClick={() => (isEditing ? undefined : onStartEdit())}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!isEditing) onStartEdit();
          }
        }}
        className={`absolute inset-0 flex items-center justify-center rounded-sm transition-colors ${isEditing ? "cursor-default" : "cursor-pointer hover:bg-bg-muted/60"}`}
      >
        <TimeReportHourCell
          value={value}
          entryId={entryId}
          dayIndex={dayIndex}
          isEditing={isEditing}
          onStartEdit={onStartEdit}
          onCommit={onCommit}
          onBlur={onBlur}
          compact={compact}
        />
      </div>
    </td>
  );
});

export function TimeReportPageClient({
  consultant,
  customers,
  initialYear,
  initialWeek,
  calendarId,
  initialHolidayDates,
}: Props) {
  const [year, setYear] = useState(initialYear);
  const [week, setWeek] = useState(initialWeek);
  const [holidayDates, setHolidayDates] = useState<string[]>(initialHolidayDates);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const router = useRouter();
  const [projectCache, setProjectCache] = useState<Record<string, ProjectOption[]>>({});
  const [taskCache, setTaskCache] = useState<Record<string, TaskOption[]>>({});
  const [projectOptionsLoading, setProjectOptionsLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [taskOptionsLoading, setTaskOptionsLoading] = useState<Record<string, boolean>>({});
  const projectLoadInflightRef = useRef<Set<string>>(new Set());
  const taskLoadInflightRef = useRef<Set<string>>(new Set());
  const [jiraDevOpsCache, setJiraDevOpsCache] = useState<Record<string, JiraDevOpsOption[]>>({});
  const [jiraOptionsLoading, setJiraOptionsLoading] = useState<Record<string, boolean>>({});
  const jiraLoadInflightRef = useRef<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<
    | { scope: "week"; entryId: string; dayIndex: number }
    | { scope: "month"; rowId: string; dateStr: string }
    | null
  >(null);
  const [commentState, setCommentState] = useState<
    | { kind: "week"; entryId: string; weekYear: number; weekWeek: number }
    | { kind: "month"; rowId: string }
    | null
  >(null);
  const [commentTexts, setCommentTexts] = useState<Record<number, string>>({});
  const [commentTextsByDate, setCommentTextsByDate] = useState<Record<string, string>>({});
  const [jiraDevOpsModal, setJiraDevOpsModal] = useState<{
    customerId: string;
    entryId: string;
  } | null>(null);
  const [jiraDevOpsModalValue, setJiraDevOpsModalValue] = useState("");
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [copyToWeekState, setCopyToWeekState] = useState<"idle" | "copying" | "error">("idle");
  const [copyRowDialog, setCopyRowDialog] = useState<
    | null
    | { mode: "current-week"; customerId: string; entry: Entry }
    | { mode: "next-month"; row: MonthMergedRow }
  >(null);
  const [copyToNextMonthState, setCopyToNextMonthState] = useState<"idle" | "copying" | "error">("idle");
  const [loadState, setLoadState] = useState<"idle" | "loading" | "loaded">("idle");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showValidationHighlights, setShowValidationHighlights] = useState(false);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRequestIdRef = useRef(0);
  const weekLoadRequestIdRef = useRef(0);
  const customerGroupsRef = useRef(customerGroups);
  const isDirtyRef = useRef(isDirty);
  const yearRef = useRef(year);
  const weekRef = useRef(week);
  const consultantRef = useRef(consultant);
  const [displayMonth, setDisplayMonth] = useState(() => {
    const { start } = getISOWeekDateRangeLocal(initialYear, initialWeek);
    return parseInt(start.slice(5, 7), 10);
  });
  const [displayYear, setDisplayYear] = useState(() => {
    const { start } = getISOWeekDateRangeLocal(initialYear, initialWeek);
    return parseInt(start.slice(0, 4), 10);
  });
  const [weekStripAnimClass, setWeekStripAnimClass] = useState<
    ""
    | "animate-week-strip-out-to-left"
    | "animate-week-strip-out-to-right"
    | "animate-week-strip-in-from-left"
    | "animate-week-strip-in-from-right"
  >("");
  const [isWeekStripTransitioning, setIsWeekStripTransitioning] = useState(false);
  const [viewMode, setViewMode] = useState<"week" | "month">("month");
  const [monthMergedRows, setMonthMergedRows] = useState<MonthMergedRow[]>([]);
  const monthLoadRequestIdRef = useRef(0);
  const viewModeRef = useRef(viewMode);
  const monthMergedRowsRef = useRef(monthMergedRows);
  const displayMonthRef = useRef(displayMonth);
  const displayYearRef = useRef(displayYear);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);
  useEffect(() => {
    monthMergedRowsRef.current = monthMergedRows;
  }, [monthMergedRows]);
  useEffect(() => {
    displayMonthRef.current = displayMonth;
  }, [displayMonth]);
  useEffect(() => {
    displayYearRef.current = displayYear;
  }, [displayYear]);

  useEffect(() => {
    customerGroupsRef.current = customerGroups;
  }, [customerGroups]);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);
  useEffect(() => {
    yearRef.current = year;
  }, [year]);
  useEffect(() => {
    weekRef.current = week;
  }, [week]);
  useEffect(() => {
    consultantRef.current = consultant;
  }, [consultant]);

  const runBatchHydrate = useCallback(async (groups: CustomerGroup[]) => {
    const { customerIds, taskOptionPairs } = collectTimeReportHydratePayload(groups);
    if (customerIds.length === 0 && taskOptionPairs.length === 0) return;

    for (const cid of customerIds) {
      setProjectOptionsLoading((s) => ({ ...s, [cid]: true }));
    }
    for (const p of taskOptionPairs) {
      const key = taskCacheKey(p.customerId, p.projectId);
      setTaskOptionsLoading((s) => ({ ...s, [key]: true }));
    }
    try {
      const result = await batchHydrateTimeReport(customerIds, taskOptionPairs);
      setProjectCache((prev) => ({ ...prev, ...result.projectsByCustomerId }));
      setTaskCache((prev) => ({ ...prev, ...result.tasksByCacheKey }));
    } finally {
      for (const cid of customerIds) {
        setProjectOptionsLoading((s) => {
          const next = { ...s };
          delete next[cid];
          return next;
        });
      }
      for (const p of taskOptionPairs) {
        const key = taskCacheKey(p.customerId, p.projectId);
        setTaskOptionsLoading((s) => {
          const next = { ...s };
          delete next[key];
          return next;
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!calendarId) {
      setHolidayDates([]);
      return;
    }
    if (viewMode === "week") {
      getHolidayDatesForWeek(calendarId, year, week).then(setHolidayDates);
      return;
    }
    const monthStart = `${displayYear}-${String(displayMonth).padStart(2, "0")}-01`;
    const last = new Date(displayYear, displayMonth, 0);
    const monthEnd = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
    getHolidayDatesForRange(calendarId, monthStart, monthEnd).then(setHolidayDates);
  }, [calendarId, year, week, viewMode, displayMonth, displayYear]);

  useEffect(() => {
    if (!consultant || viewMode !== "week") return;

    setLoadState("loading");
    // Clear old week view immediately to avoid showing stale rows during week switch.
    setCustomerGroups([]);
    const requestId = ++weekLoadRequestIdRef.current;
    getTimeReportEntries(consultant.id, year, week)
      .then((groups) => {
        if (requestId !== weekLoadRequestIdRef.current) return;
        setCustomerGroups(groups);
        setLoadState("loaded");
        setIsDirty(false);
        void runBatchHydrate(groups);
      })
      .catch(() => {
        if (requestId !== weekLoadRequestIdRef.current) return;
        setLoadState("loaded");
      });
  }, [consultant?.id, year, week, runBatchHydrate, viewMode]);

  useEffect(() => {
    if (!consultant || viewMode !== "month") return;

    setLoadState("loading");
    setMonthMergedRows([]);
    const weeks = getWeeksInMonthLocal(displayMonth, displayYear);
    const requestId = ++monthLoadRequestIdRef.current;
    const calDates = getCalendarDatesInMonth(displayYear, displayMonth);
    Promise.all(weeks.map(({ year: y, week: w }) => getTimeReportEntries(consultant.id, y, w)))
      .then((allGroups) => {
        if (requestId !== monthLoadRequestIdRef.current) return;
        const slices: Record<string, CustomerGroup[]> = {};
        weeks.forEach(({ year: y, week: w }, i) => {
          slices[weekSliceKey(y, w)] = allGroups[i] ?? [];
        });
        const mergedRows = buildMergedMonthRows(slices, weeks, calDates);
        setMonthMergedRows(mergedRows);
        setLoadState("loaded");
        setIsDirty(false);
        void runBatchHydrate(pseudoCustomerGroupsForHydrate(mergedRows));
      })
      .catch(() => {
        if (requestId !== monthLoadRequestIdRef.current) return;
        setLoadState("loaded");
      });
  }, [consultant?.id, viewMode, displayMonth, displayYear, runBatchHydrate]);

  useEffect(() => {
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }
    if (!isDirty || !consultant) return;

    // Debounce autosave to avoid one request per keystroke.
    saveDebounceRef.current = setTimeout(() => {
      const saveStart = performance.now();
      const requestId = ++saveRequestIdRef.current;
      setSaveState("saving");
      setSaveError(null);
      const cid = consultant.id;
      const mode = viewModeRef.current;

      const finishOk = () => {
        if (requestId !== saveRequestIdRef.current) return;
        setSaveState("idle");
        setIsDirty(false);
        isDirtyRef.current = false;
        setShowValidationHighlights(false);
      };
      const finishErr = (msg: string, validation?: boolean) => {
        if (requestId !== saveRequestIdRef.current) return;
        setSaveError(msg);
        setSaveState("error");
        if (validation && msg.includes("Project and Role")) {
          setShowValidationHighlights(true);
        }
      };

      if (mode === "week") {
        saveTimeReportEntries(cid, yearRef.current, weekRef.current, customerGroupsRef.current)
          .then((result) => {
            if (requestId !== saveRequestIdRef.current) return;
            if (result.error) {
              finishErr(result.error, true);
            } else {
              finishOk();
            }
            if (ENABLE_PERF_DEBUG) {
              fetch("http://127.0.0.1:7377/ingest/142286f1-190a-49b6-8e1e-854ceb792769", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Debug-Session-Id": "97edeb",
                },
                body: JSON.stringify({
                  sessionId: "97edeb",
                  runId: "perf-scan-1",
                  hypothesisId: "H3",
                  location: "TimeReportPageClient.tsx:autosave-week",
                  message: "time report autosave result",
                  data: {
                    ms: Math.round((performance.now() - saveStart) * 100) / 100,
                    week: weekRef.current,
                    year: yearRef.current,
                    groups: customerGroupsRef.current.length,
                    error: result.error ?? null,
                  },
                  timestamp: Date.now(),
                }),
              }).catch(() => {});
            }
          })
          .catch(() => {
            if (requestId !== saveRequestIdRef.current) return;
            setSaveState("error");
            setSaveError("Save failed");
          });
        return;
      }

      void (async () => {
        const weeks = getWeeksInMonthLocal(displayMonthRef.current, displayYearRef.current);
        const rows = monthMergedRowsRef.current;
        for (const { year: y, week: w } of weeks) {
          const groups = buildCustomerGroupsForWeekFromMerged(rows, y, w);
          const result = await saveTimeReportEntries(cid, y, w, groups);
          if (requestId !== saveRequestIdRef.current) return;
          if (result.error) {
            finishErr(result.error, true);
            return;
          }
        }
        finishOk();
        if (ENABLE_PERF_DEBUG) {
          fetch("http://127.0.0.1:7377/ingest/142286f1-190a-49b6-8e1e-854ceb792769", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "97edeb",
            },
            body: JSON.stringify({
              sessionId: "97edeb",
              runId: "perf-scan-1",
              hypothesisId: "H3",
              location: "TimeReportPageClient.tsx:autosave-month",
              message: "time report month autosave done",
              data: {
                ms: Math.round((performance.now() - saveStart) * 100) / 100,
                weeks: weeks.length,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
        }
      })();
    }, 700);

    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = null;
      }
    };
  }, [isDirty, customerGroups, monthMergedRows, viewMode, year, week, consultant?.id, displayMonth, displayYear]);

  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const handleClick = (e: MouseEvent) => {
      const link = (e.target as Element).closest("a[href]");
      if (!link) return;
      const href = (link as HTMLAnchorElement).getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      const isInternal = href.startsWith("/") || (typeof window !== "undefined" && new URL(href, window.location.origin).origin === window.location.origin);
      if (!isInternal) return;
      const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
      const linkPath = href.startsWith("/") ? href : new URL(href, window.location.origin).pathname;
      if (linkPath === currentPath) return;
      e.preventDefault();
      e.stopPropagation();
      if (window.confirm("You have unsaved changes. Leave this page?")) {
        const path = href.startsWith("/") ? href : new URL(href, window.location.origin).pathname;
        router.push(path);
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isDirty, router]);

  const flushSave = useCallback(async (): Promise<boolean> => {
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }

    if (typeof document !== "undefined") {
      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement && typeof activeElement.blur === "function") {
        activeElement.blur();
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }

    const activeConsultant = consultantRef.current;
    if (!isDirtyRef.current || !activeConsultant) return true;

    const requestId = ++saveRequestIdRef.current;
    setSaveState("saving");
    setSaveError(null);
    try {
      if (viewModeRef.current === "week") {
        const result = await saveTimeReportEntries(
          activeConsultant.id,
          yearRef.current,
          weekRef.current,
          customerGroupsRef.current
        );
        if (requestId !== saveRequestIdRef.current) return false;
        if (result.error) {
          setSaveError(result.error);
          setSaveState("error");
          if (result.error.includes("Project and Role")) {
            setShowValidationHighlights(true);
          }
          return false;
        }
      } else {
        const weeks = getWeeksInMonthLocal(displayMonthRef.current, displayYearRef.current);
        const rows = monthMergedRowsRef.current;
        for (const { year: y, week: w } of weeks) {
          const groups = buildCustomerGroupsForWeekFromMerged(rows, y, w);
          const result = await saveTimeReportEntries(activeConsultant.id, y, w, groups);
          if (requestId !== saveRequestIdRef.current) return false;
          if (result.error) {
            setSaveError(result.error);
            setSaveState("error");
            if (result.error.includes("Project and Role")) {
              setShowValidationHighlights(true);
            }
            return false;
          }
        }
      }
      if (requestId !== saveRequestIdRef.current) return false;
      setSaveState("idle");
      setIsDirty(false);
      isDirtyRef.current = false;
      setShowValidationHighlights(false);
      return true;
    } catch {
      if (requestId !== saveRequestIdRef.current) return false;
      setSaveState("error");
      setSaveError("Save failed");
      return false;
    }
  }, []);

  const weekDates = useMemo(() => getWeekDates(year, week), [year, week]);
  const todayStr = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
  }, []);
  const isTodayColumn = useCallback(
    (dayIndex: number) => weekDates[dayIndex] === todayStr,
    [weekDates, todayStr]
  );

  const holidayDateSet = useMemo(() => new Set(holidayDates), [holidayDates]);
  const isDayGrayed = useCallback(
    (dayIndex: number) => {
      const isWeekend = dayIndex === 5 || dayIndex === 6;
      const isHoliday = holidayDateSet.has(weekDates[dayIndex]!);
      return isWeekend || isHoliday;
    },
    [holidayDateSet, weekDates]
  );

  const isMonthDateGrayed = useCallback(
    (dateStr: string) => {
      const d = new Date(dateStr + "T12:00:00");
      const dow = d.getDay();
      const isWeekend = dow === 0 || dow === 6;
      return isWeekend || holidayDateSet.has(dateStr);
    },
    [holidayDateSet]
  );
  const isMonthDateToday = useCallback(
    (dateStr: string) => dateStr === todayStr,
    [todayStr]
  );

  const isWeekDayWeekend = useCallback((dayIndex: number) => dayIndex === 5 || dayIndex === 6, []);
  const isMonthDateWeekend = useCallback((dateStr: string) => {
    const dow = new Date(dateStr + "T12:00:00").getDay();
    return dow === 0 || dow === 6;
  }, []);

  /** Cell-only: weekend columns a bit stronger than weekday public holidays (headers stay uniform). */
  const dayCellWeekendGrayClass = "bg-bg-muted/60";
  const dayCellHolidayWeekdayGrayClass = "bg-bg-muted/51";
  const dayHeaderGrayClass = "bg-bg-muted/40 text-text-muted";
  const todayColumnClass = "bg-brand-blue/32";
  const todayHeaderClass = "bg-brand-blue/15";

  const applyCalendarMonth = useCallback((newYear: number, newMonth: number) => {
    setDisplayYear(newYear);
    setDisplayMonth(newMonth);
    const weeks = getWeeksInMonthLocal(newMonth, newYear);
    if (weeks.length > 0) {
      setYear(weeks[0].year);
      setWeek(weeks[0].week);
    }
  }, []);

  const goPrevWeek = async () => {
    const ok = await flushSave();
    if (!ok) return;
    const next = addWeeksToYearWeekLocal(year, week, -1);
    setYear(next.year);
    setWeek(next.week);
  };

  const goNextWeek = async () => {
    const ok = await flushSave();
    if (!ok) return;
    const next = addWeeksToYearWeekLocal(year, week, 1);
    setYear(next.year);
    setWeek(next.week);
  };

  const goPrevMonth = async () => {
    if (isWeekStripTransitioning) return;
    const ok = await flushSave();
    if (!ok) return;
    let newMonth = displayMonth - 1;
    let newYear = displayYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    if (viewMode === "week") {
      setIsWeekStripTransitioning(true);
      setWeekStripAnimClass("animate-week-strip-out-to-right");
      window.setTimeout(() => {
        applyCalendarMonth(newYear, newMonth);
        setWeekStripAnimClass("animate-week-strip-in-from-left");
        window.setTimeout(() => {
          setWeekStripAnimClass("");
          setIsWeekStripTransitioning(false);
        }, 320);
      }, 280);
    } else {
      applyCalendarMonth(newYear, newMonth);
    }
  };

  const goNextMonth = async () => {
    if (isWeekStripTransitioning) return;
    const ok = await flushSave();
    if (!ok) return;
    let newMonth = displayMonth + 1;
    let newYear = displayYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    if (viewMode === "week") {
      setIsWeekStripTransitioning(true);
      setWeekStripAnimClass("animate-week-strip-out-to-left");
      window.setTimeout(() => {
        applyCalendarMonth(newYear, newMonth);
        setWeekStripAnimClass("animate-week-strip-in-from-right");
        window.setTimeout(() => {
          setWeekStripAnimClass("");
          setIsWeekStripTransitioning(false);
        }, 320);
      }, 280);
    } else {
      applyCalendarMonth(newYear, newMonth);
    }
  };

  const jumpToWeek = useCallback(
    async (nextYear: number, nextWeek: number) => {
      if (nextYear === year && nextWeek === week) return;
      const ok = await flushSave();
      if (!ok) return;
      setYear(nextYear);
      setWeek(nextWeek);
    },
    [flushSave, week, year]
  );

  const onPickCalendarMonth = useCallback(
    async (ym: string) => {
      if (isWeekStripTransitioning) return;
      const parts = ym.split("-");
      const newYear = parseInt(parts[0]!, 10);
      const newMonth = parseInt(parts[1]!, 10);
      if (!Number.isFinite(newYear) || !Number.isFinite(newMonth)) return;
      if (newYear === displayYear && newMonth === displayMonth) return;
      const ok = await flushSave();
      if (!ok) return;
      applyCalendarMonth(newYear, newMonth);
    },
    [
      applyCalendarMonth,
      displayMonth,
      displayYear,
      flushSave,
      isWeekStripTransitioning,
    ]
  );

  const switchToMonthView = useCallback(async () => {
    if (viewMode === "month") return;
    const ok = await flushSave();
    if (!ok) return;
    setViewMode("month");
  }, [flushSave, viewMode]);

  const switchToWeekView = useCallback(async () => {
    if (viewMode === "week") return;
    const ok = await flushSave();
    if (!ok) return;
    setViewMode("week");
  }, [flushSave, viewMode]);

  const customerOptionsForSelect = [
    { value: "", label: "—" },
    ...customers.map((c) => ({ value: c.id, label: c.name })),
  ];

  const availableToAdd = customers.filter((c) => {
    if (viewMode === "week") {
      return !customerGroups.some((g) => g.customerId === c.id);
    }
    return !monthMergedRows.some((r) => r.customerId === c.id);
  });
  const customerById = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  );
  const entryById = useMemo(() => {
    const map = new Map<string, Entry>();
    if (viewMode === "week") {
      customerGroups.forEach((g) => {
        g.entries.forEach((e) => map.set(e.id, e));
      });
    } else {
      for (const r of monthMergedRows) {
        map.set(r.id, {
          id: r.id,
          projectId: r.projectId,
          roleId: r.roleId,
          jiraDevOpsValue: r.jiraDevOpsValue,
          task: r.task,
          hours: [0, 0, 0, 0, 0, 0, 0],
          comments: {},
        });
      }
    }
    return map;
  }, [viewMode, customerGroups, monthMergedRows]);
  const customerIdByEntryId = useMemo(() => {
    const map = new Map<string, string>();
    if (viewMode === "week") {
      customerGroups.forEach((g) => {
        g.entries.forEach((e) => map.set(e.id, g.customerId));
      });
    } else {
      for (const r of monthMergedRows) {
        map.set(r.id, r.customerId);
      }
    }
    return map;
  }, [viewMode, customerGroups, monthMergedRows]);
  const jiraOptionByProjectAndValue = useMemo(() => {
    const map = new Map<string, JiraDevOpsOption>();
    Object.entries(jiraDevOpsCache).forEach(([projectId, options]) => {
      options.forEach((option) => map.set(`${projectId}|${option.value}`, option));
    });
    return map;
  }, [jiraDevOpsCache]);

  const loadProjectsForCustomer = useCallback(async (customerId: string) => {
    if (!customerId) return;
    if (projectCache[customerId] !== undefined) return;
    if (projectLoadInflightRef.current.has(customerId)) return;
    projectLoadInflightRef.current.add(customerId);
    setProjectOptionsLoading((s) => ({ ...s, [customerId]: true }));
    try {
      const list = await getActiveProjectsForCustomer(customerId);
      setProjectCache((prev) =>
        prev[customerId] !== undefined ? prev : { ...prev, [customerId]: list }
      );
    } finally {
      projectLoadInflightRef.current.delete(customerId);
      setProjectOptionsLoading((s) => {
        const next = { ...s };
        delete next[customerId];
        return next;
      });
    }
  }, [projectCache]);

  const loadTaskOptions = useCallback(async (customerId: string, projectId: string) => {
    const key = taskCacheKey(customerId, projectId);
    if (!customerId) return;
    if (taskCache[key] !== undefined) return;
    if (taskLoadInflightRef.current.has(key)) return;
    taskLoadInflightRef.current.add(key);
    setTaskOptionsLoading((s) => ({ ...s, [key]: true }));
    try {
      const list = await getTaskOptionsForCustomerAndProject(customerId, projectId || undefined);
      setTaskCache((prev) => (prev[key] !== undefined ? prev : { ...prev, [key]: list }));
    } finally {
      taskLoadInflightRef.current.delete(key);
      setTaskOptionsLoading((s) => {
        const next = { ...s };
        delete next[key];
        return next;
      });
    }
  }, [taskCache]);

  const loadJiraDevOpsForProject = useCallback(async (projectId: string) => {
    if (!projectId) return;
    if (jiraDevOpsCache[projectId] !== undefined) return;
    if (jiraLoadInflightRef.current.has(projectId)) return;
    jiraLoadInflightRef.current.add(projectId);
    setJiraOptionsLoading((s) => ({ ...s, [projectId]: true }));
    try {
      const list = await getJiraDevOpsOptionsForProject(projectId);
      setJiraDevOpsCache((prev) =>
        prev[projectId] !== undefined ? prev : { ...prev, [projectId]: list }
      );
    } finally {
      jiraLoadInflightRef.current.delete(projectId);
      setJiraOptionsLoading((s) => {
        const next = { ...s };
        delete next[projectId];
        return next;
      });
    }
  }, [jiraDevOpsCache]);

  const getProjectOptions = (customerId: string): { value: string; label: string }[] => {
    if (!customerId) return [{ value: "", label: "—" }];
    const list = projectCache[customerId];
    if (list === undefined) return [{ value: "", label: "—" }];
    return [{ value: "", label: "—" }, ...list];
  };

  const getTaskOptions = (customerId: string, projectId: string): { value: string; label: string }[] => {
    if (!customerId) return [{ value: "", label: "—" }];
    const key = taskCacheKey(customerId, projectId);
    const list = taskCache[key];
    if (list === undefined) return [{ value: "", label: "—" }];
    return [{ value: "", label: "—" }, ...list];
  };

  const getJiraDevOpsOptions = (projectId: string): { value: string; label: string; url?: string | null }[] => {
    if (!projectId) return [{ value: "", label: "—" }];
    const list = jiraDevOpsCache[projectId];
    if (list === undefined) return [{ value: "", label: "—" }];
    return [{ value: "", label: "—" }, ...list];
  };

  const updateEntryInGroup = (customerId: string, entryId: string, patch: Partial<Entry>) => {
    setIsDirty(true);
    if (viewMode === "week") {
      setCustomerGroups((prev) =>
        prev.map((g) =>
          g.customerId !== customerId
            ? g
            : {
                ...g,
                entries: g.entries.map((e) =>
                  e.id !== entryId ? e : { ...e, ...patch }
                ),
              }
        )
      );
      return;
    }
    setMonthMergedRows((prev) =>
      prev.map((r) => {
        if (r.customerId !== customerId || r.id !== entryId) return r;
        const next = { ...r };
        if (patch.projectId !== undefined) next.projectId = patch.projectId;
        if (patch.roleId !== undefined) next.roleId = patch.roleId;
        if (patch.jiraDevOpsValue !== undefined) next.jiraDevOpsValue = patch.jiraDevOpsValue;
        if (patch.task !== undefined) next.task = patch.task ?? "";
        return next;
      })
    );
  };

  const addCustomerGroup = (customerId: string) => {
    if (viewMode === "week") {
      if (customerGroups.some((g) => g.customerId === customerId)) return;
      setIsDirty(true);
      setCustomerGroups((prev) => [
        ...prev,
        { customerId, entries: [newEntry()] },
      ]);
    } else {
      if (monthMergedRows.some((r) => r.customerId === customerId)) return;
      setIsDirty(true);
      setMonthMergedRows((prev) => [
        ...prev,
        newMonthMergedRow(customerId, getCalendarDatesInMonth(displayYear, displayMonth)),
      ]);
    }
    setAddCustomerOpen(false);
    const c = customerById.get(customerId);
    if (c) loadProjectsForCustomer(customerId);
  };

  const refreshAfterCopyToCurrentWeek = useCallback(() => {
    const c = consultantRef.current;
    if (!c) return;
    if (viewModeRef.current === "month") {
      const weeks = getWeeksInMonthLocal(displayMonthRef.current, displayYearRef.current);
      const calDates = getCalendarDatesInMonth(
        displayYearRef.current,
        displayMonthRef.current
      );
      void Promise.all(weeks.map(({ year: y, week: w }) => getTimeReportEntries(c.id, y, w))).then(
        (allGroups) => {
          const slices: Record<string, CustomerGroup[]> = {};
          weeks.forEach(({ year: y, week: w }, i) => {
            slices[weekSliceKey(y, w)] = allGroups[i] ?? [];
          });
          const mergedRows = buildMergedMonthRows(slices, weeks, calDates);
          setMonthMergedRows(mergedRows);
          void runBatchHydrate(pseudoCustomerGroupsForHydrate(mergedRows));
        }
      );
      return;
    }
    if (yearRef.current === initialYear && weekRef.current === initialWeek) {
      getTimeReportEntries(c.id, yearRef.current, weekRef.current).then((groups) => {
        setCustomerGroups(groups);
        void runBatchHydrate(groups);
      });
    }
  }, [runBatchHydrate]);

  const performCopyRowToCurrentWeek = async (
    customerId: string,
    entry: Entry,
    copyHours: boolean
  ) => {
    if (!consultant || !entry.projectId || !entry.roleId) return;
    if (year === initialYear && week === initialWeek) return;
    if (copyHours && !entryHasContent(entry)) return;

    const ok = await flushSave();
    if (!ok) return;
    setCopyRowDialog(null);

    setCopyToWeekState("copying");
    setSaveError(null);
    const result = await copyEntryToWeek(
      consultant.id,
      initialYear,
      initialWeek,
      customerId,
      {
        projectId: entry.projectId,
        roleId: entry.roleId,
        jiraDevOpsValue: entry.jiraDevOpsValue,
        task: entry.task ?? "",
        hours: entry.hours,
        comments: entry.comments,
        copyHours,
      }
    );
    if (result.error) {
      setCopyToWeekState("error");
      setSaveError(result.error);
      return;
    }
    setCopyToWeekState("idle");
    refreshAfterCopyToCurrentWeek();
  };

  const performCopyMergedRowToNextMonth = async (row: MonthMergedRow, copyHours: boolean) => {
    if (!consultant || !row.projectId || !row.roleId) return;
    if (copyHours && !mergedRowHasContent(row)) return;

    const ok = await flushSave();
    if (!ok) return;
    setCopyRowDialog(null);

    const { y: ny, m: nm } = nextCalendarMonth(displayYear, displayMonth);
    const curDates = getCalendarDatesInMonth(displayYear, displayMonth);
    const nextDates = getCalendarDatesInMonth(ny, nm);
    const hoursByNext: Record<string, number> = {};
    const commentsByNext: Record<string, string> = {};
    for (const d of nextDates) {
      hoursByNext[d] = 0;
      commentsByNext[d] = "";
    }
    if (copyHours) {
      for (const d of curDates) {
        const h = row.hoursByDate[d] ?? 0;
        const c = (row.commentsByDate[d] ?? "").trim();
        if (h === 0 && !c) continue;
        const mapped = mapDateSameDomToMonth(d, ny, nm);
        hoursByNext[mapped] = (hoursByNext[mapped] ?? 0) + h;
        if (c) commentsByNext[mapped] = c;
      }
    }

    setCopyToNextMonthState("copying");
    setSaveError(null);
    const nextWeeks = getWeeksInMonthLocal(nm, ny);
    for (const { year: y, week: w } of nextWeeks) {
      const wd = getWeekDates(y, w);
      const hours = wd.map((d) => hoursByNext[d] ?? 0);
      const comments: Record<number, string> = {};
      wd.forEach((d, i) => {
        const t = (commentsByNext[d] ?? "").trim();
        if (t) comments[i] = commentsByNext[d] ?? "";
      });
      const has = hours.some((hh) => (hh ?? 0) > 0) || Object.keys(comments).length > 0;
      if (copyHours && !has) continue;

      const result = await copyEntryToWeek(consultant.id, y, w, row.customerId, {
        projectId: row.projectId,
        roleId: row.roleId,
        jiraDevOpsValue: row.jiraDevOpsValue,
        task: row.task,
        hours,
        comments,
        copyHours,
      });
      if (result.error) {
        setCopyToNextMonthState("error");
        setSaveError(result.error);
        return;
      }
    }
    setCopyToNextMonthState("idle");
  };

  const addRow = (customerId: string) => {
    setIsDirty(true);
    if (viewMode === "week") {
      setCustomerGroups((prev) =>
        prev.map((g) =>
          g.customerId !== customerId
            ? g
            : { ...g, entries: [...g.entries, newEntry()] }
        )
      );
      return;
    }
    const dates = getCalendarDatesInMonth(displayYear, displayMonth);
    const newRow = newMonthMergedRow(customerId, dates);
    setMonthMergedRows((prev) => {
      let insertAt = prev.length;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i]!.customerId === customerId) {
          insertAt = i + 1;
          break;
        }
      }
      return [...prev.slice(0, insertAt), newRow, ...prev.slice(insertAt)];
    });
  };

  const duplicateRow = (customerId: string, entryId: string) => {
    setIsDirty(true);
    if (viewMode === "week") {
      setCustomerGroups((prev) =>
        prev.map((g) => {
          if (g.customerId !== customerId) return g;
          const source = g.entries.find((e) => e.id === entryId);
          if (!source) return g;
          return {
            ...g,
            entries: [
              ...g.entries,
              {
                ...newEntry(),
                projectId: source.projectId,
                roleId: source.roleId,
              },
            ],
          };
        })
      );
      return;
    }

    const dates = getCalendarDatesInMonth(displayYear, displayMonth);
    const duplicate = (source: MonthMergedRow): MonthMergedRow => ({
      ...newMonthMergedRow(customerId, dates),
      projectId: source.projectId,
      roleId: source.roleId,
    });
    setMonthMergedRows((prev) => {
      const index = prev.findIndex((r) => r.customerId === customerId && r.id === entryId);
      if (index === -1) return prev;
      const source = prev[index]!;
      const next = duplicate(source);
      return [...prev.slice(0, index + 1), next, ...prev.slice(index + 1)];
    });
  };

  const removeEntry = (customerId: string, entryId: string) => {
    setIsDirty(true);
    if (viewMode === "week") {
      setCustomerGroups((prev) =>
        prev
          .map((g) =>
            g.customerId !== customerId
              ? g
              : { ...g, entries: g.entries.filter((e) => e.id !== entryId) }
          )
          .filter((g) => g.entries.length > 0)
      );
    } else {
      setMonthMergedRows((prev) =>
        prev.filter((r) => !(r.customerId === customerId && r.id === entryId))
      );
    }
    if (
      editingCell &&
      ((editingCell.scope === "week" && editingCell.entryId === entryId) ||
        (editingCell.scope === "month" && editingCell.rowId === entryId))
    ) {
      setEditingCell(null);
    }
  };

  const entryHasComment = (entry: Entry): boolean =>
    Object.values(entry.comments).some((c) => (c ?? "").trim() !== "");

  const openComment = (entryId: string) => {
    const entry = entryById.get(entryId);
    const texts: Record<number, string> = {};
    for (let i = 0; i < 7; i++) {
      texts[i] = entry?.comments[i]?.trim() ?? "";
    }
    setCommentTexts(entry ? texts : {});
    setCommentState({ kind: "week", entryId, weekYear: year, weekWeek: week });
  };

  const openCommentMonth = (rowId: string) => {
    const dates = getCalendarDatesInMonth(displayYear, displayMonth);
    const row = monthMergedRows.find((r) => r.id === rowId);
    const texts: Record<string, string> = {};
    for (const d of dates) {
      texts[d] = (row?.commentsByDate[d] ?? "").trim();
    }
    setCommentTextsByDate(texts);
    setCommentState({ kind: "month", rowId });
  };

  const saveComment = () => {
    if (!commentState) return;
    setIsDirty(true);
    if (commentState.kind === "week") {
      const customerId = customerIdByEntryId.get(commentState.entryId);
      if (!customerId) return;
      const entry = entryById.get(commentState.entryId);
      const comments: Record<number, string> = {};
      for (let i = 0; i < 7; i++) {
        if ((entry?.hours[i] ?? 0) <= 0) continue;
        const t = (commentTexts[i] ?? "").trim();
        if (t) comments[i] = t;
      }
      const { entryId } = commentState;
      setCustomerGroups((prev) =>
        prev.map((g) =>
          g.customerId !== customerId
            ? g
            : {
                ...g,
                entries: g.entries.map((e) =>
                  e.id !== entryId ? e : { ...e, comments }
                ),
              }
        )
      );
    } else {
      const dates = getCalendarDatesInMonth(displayYear, displayMonth);
      setMonthMergedRows((prev) =>
        prev.map((r) => {
          if (r.id !== commentState.rowId) return r;
          const nextComments = { ...r.commentsByDate };
          for (const d of dates) {
            if ((r.hoursByDate[d] ?? 0) <= 0) {
              delete nextComments[d];
              continue;
            }
            const t = (commentTextsByDate[d] ?? "").trim();
            if (t) nextComments[d] = t;
            else delete nextComments[d];
          }
          return { ...r, commentsByDate: nextComments };
        })
      );
    }
    setCommentState(null);
  };

  const { start: weekStartStr } = getISOWeekDateRangeLocal(year, week);
  const weekStart = new Date(weekStartStr + "T12:00:00");
  const dayDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d.getDate();
  });

  const weekTotalHours = useMemo(
    () => customerGroups.reduce((sum, g) => sum + groupTotalHours(g.entries), 0),
    [customerGroups]
  );

  const weekTotalDisplay = useMemo(() => {
    const w = weekTotalHours;
    if (!Number.isFinite(w) || w === 0) return "";
    return Math.abs(w - Math.round(w)) < 1e-6
      ? String(Math.round(w))
      : String(Math.round(w * 10) / 10).replace(/\.0$/, "");
  }, [weekTotalHours]);

  const calendarMonthValue = `${displayYear}-${String(displayMonth).padStart(2, "0")}`;

  const calendarMonthSelectOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const fromY = displayYear - 3;
    const toY = displayYear + 4;
    for (let y = fromY; y <= toY; y++) {
      for (let m = 1; m <= 12; m++) {
        const labelRaw = new Date(y, m - 1, 15).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
        const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);
        out.push({
          value: `${y}-${String(m).padStart(2, "0")}`,
          label,
        });
      }
    }
    return out;
  }, [displayYear]);

  const monthWeeks = useMemo(
    () => getWeeksInMonthLocal(displayMonth, displayYear),
    [displayMonth, displayYear]
  );

  const monthCalendarDates = useMemo(
    () => getCalendarDatesInMonth(displayYear, displayMonth),
    [displayYear, displayMonth]
  );

  const monthRowsByCustomer = useMemo(() => {
    const byCustomer = new Map<string, MonthMergedRow[]>();
    const order: string[] = [];
    for (const row of monthMergedRows) {
      if (!byCustomer.has(row.customerId)) {
        byCustomer.set(row.customerId, []);
        order.push(row.customerId);
      }
      byCustomer.get(row.customerId)!.push(row);
    }
    return order.map((id) => ({ customerId: id, rows: byCustomer.get(id)! }));
  }, [monthMergedRows]);

  const monthDateDayTotals = useMemo(
    () =>
      monthCalendarDates.map((dateStr) =>
        monthMergedRows.reduce((sum, row) => sum + (row.hoursByDate[dateStr] ?? 0), 0)
      ),
    [monthCalendarDates, monthMergedRows]
  );

  const monthGridTotalHours = useMemo(
    () => monthDateDayTotals.reduce((a, b) => a + b, 0),
    [monthDateDayTotals]
  );
  const monthGridTotalDisplay = useMemo(() => {
    const w = monthGridTotalHours;
    if (!Number.isFinite(w) || w === 0) return "";
    return Math.abs(w - Math.round(w)) < 1e-6
      ? String(Math.round(w))
      : String(Math.round(w * 100) / 100).replace(/\.?0+$/, "");
  }, [monthGridTotalHours]);

  const monthTableColSpan = 5 + monthCalendarDates.length + 1;

  const commentDialogWeekDayNumbers = useMemo(() => {
    if (!commentState || commentState.kind !== "week") return dayDates;
    return getWeekDates(commentState.weekYear, commentState.weekWeek).map((s) =>
      parseInt(s.slice(8, 10), 10)
    );
  }, [commentState, dayDates]);

  const commentDialogWeekEntry = useMemo(() => {
    if (!commentState || commentState.kind !== "week") return null;
    return entryById.get(commentState.entryId) ?? null;
  }, [commentState, entryById]);

  const commentDialogMonthRow = useMemo(() => {
    if (!commentState || commentState.kind !== "month") return null;
    return monthMergedRows.find((r) => r.id === commentState.rowId) ?? null;
  }, [commentState, monthMergedRows]);

  const totalHoursPerDay = useMemo(
    () =>
      customerGroups.reduce<number[]>(
        (acc, g) => {
          const daily = dayTotals(g.entries);
          daily.forEach((h, i) => {
            acc[i] = (acc[i] ?? 0) + h;
          });
          return acc;
        },
        [0, 0, 0, 0, 0, 0, 0]
      ),
    [customerGroups]
  );
  const totalEntries = useMemo(() => {
    if (viewMode === "week") {
      return customerGroups.reduce((n, g) => n + g.entries.length, 0);
    }
    return monthMergedRows.length;
  }, [viewMode, customerGroups, monthMergedRows]);

  useEffect(() => {
    if (!ENABLE_PERF_DEBUG) return;
    fetch("http://127.0.0.1:7377/ingest/142286f1-190a-49b6-8e1e-854ceb792769", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "97edeb",
      },
      body: JSON.stringify({
        sessionId: "97edeb",
        runId: "perf-scan-1",
        hypothesisId: "H4",
        location: "TimeReportPageClient.tsx",
        message: "time report render summary",
        data: {
          customerGroups: customerGroups.length,
          totalEntries,
          weekTotalHours,
          loadState,
          saveState,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, [customerGroups.length, totalEntries, weekTotalHours, loadState, saveState]);

  if (!consultant) {
    return (
      <div className="rounded-lg bg-bg-muted p-6 text-center text-text-secondary">
        Link your user to a consultant to report time.
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex justify-end">
          <div className="flex items-center gap-0.5 rounded-md p-0.5">
            <Button
              type="button"
              variant={viewMode === "month" ? "primary" : "secondary"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => void switchToMonthView()}
            >
              Month
            </Button>
            <Button
              type="button"
              variant={viewMode === "week" ? "primary" : "secondary"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => void switchToWeekView()}
            >
              Week
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <div className="flex w-full min-w-0 items-center justify-start gap-2 px-1">
              <IconButton
                aria-label="Previous month"
                title="Previous month"
                onClick={() => void goPrevMonth()}
                disabled={isWeekStripTransitioning}
              >
                <ChevronLeft className="h-5 w-5" />
              </IconButton>
              <Select
                value={calendarMonthValue}
                onValueChange={(v) => void onPickCalendarMonth(v)}
                options={calendarMonthSelectOptions}
                disabled={isWeekStripTransitioning}
                size="sm"
                variant="filter"
                triggerClassName="h-8 min-w-[12rem] max-w-[min(100%,20rem)] justify-between text-xs"
                viewportClassName="max-h-64"
              />
              <IconButton
                aria-label="Next month"
                title="Next month"
                onClick={() => void goNextMonth()}
                disabled={isWeekStripTransitioning}
              >
                <ChevronRight className="h-5 w-5" />
              </IconButton>
            </div>
            {viewMode === "week" && (
              <div
                className={`flex w-full min-w-0 flex-wrap items-center justify-start gap-1.5 px-1 ${weekStripAnimClass}`}
              >
                {monthWeeks.map(({ year: wY, week: w }) => {
                  const isSelected = wY === year && w === week;
                  const isCurrentWeek = wY === initialYear && w === initialWeek;
                  return (
                    <button
                      key={`${wY}-${w}`}
                      type="button"
                      onClick={() => void jumpToWeek(wY, w)}
                      className={`w-[4rem] cursor-pointer shrink-0 rounded-md px-1.5 py-0.5 text-center text-[11px] font-medium transition-colors whitespace-nowrap ${
                        isSelected
                          ? "bg-brand-blue text-white"
                          : "bg-bg-muted text-text-secondary hover:bg-bg-muted/80 hover:text-text-primary"
                      } ${!isSelected && isCurrentWeek ? "ring-2 ring-brand-blue ring-offset-1 ring-offset-bg-default" : ""}`}
                      aria-label={`Week ${w}${isCurrentWeek ? " (current week)" : ""}`}
                      aria-pressed={isSelected}
                      title={isCurrentWeek ? "Current week" : `Week ${w}`}
                    >
                      W{w}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex min-h-5 flex-wrap items-center justify-end gap-2">
              <span
                className={`text-xs text-text-secondary ${saveState === "saving" ? "" : "invisible"}`}
                aria-hidden={saveState !== "saving"}
              >
                Saving…
              </span>
              {saveState === "error" && saveError && (
                <span className="text-xs text-red-600" role="alert">
                  {saveError}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {loadState === "loading" ? (
        <div className="overflow-hidden rounded-lg bg-bg-default">
          <div className="h-0.5 w-full bg-brand-blue/70" />
          <div className="p-4">
            <div className="mb-3 flex items-center gap-2 text-xs text-text-secondary">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue/80" aria-hidden />
              <span>Loading time report…</span>
            </div>
            <div className="space-y-2">
              <div className="h-7 rounded-md bg-bg-muted/40" />
              <div className="h-7 rounded-md bg-bg-muted/30" />
              <div className="h-7 rounded-md bg-bg-muted/25" />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className={
              viewMode === "month"
                ? "w-full min-w-0 overflow-x-auto rounded-lg"
                : "overflow-x-auto rounded-lg"
            }
          >
          {viewMode === "week" ? (
          <table className="w-full table-fixed border-collapse text-xs">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-muted/40">
                <th className="w-[4.5rem] min-w-[4.5rem] px-1 py-1.5" aria-hidden />
                <th className="w-[140px] min-w-[140px] max-w-[140px] px-1.5 py-1.5 text-left font-medium text-text-secondary">
                  Project
                </th>
                <th className="w-[140px] min-w-[140px] max-w-[140px] px-1.5 py-1.5 text-left font-medium text-text-secondary">
                  Role
                </th>
                <th className="w-[200px] min-w-[200px] max-w-[200px] px-1.5 py-1.5 text-left font-medium text-text-secondary">
                  Description
                </th>
                <th className="w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] px-1 py-1.5 text-center font-medium text-text-secondary" scope="col" title="Jira / DevOps">
                  <Link className="inline-block h-4 w-4 text-text-muted" aria-hidden />
                </th>
                {TIME_REPORT_DAY_LABELS.map((label, i) => (
                  <th
                    key={i}
                    className={`w-[3rem] min-w-[3rem] border-r border-border-subtle p-0 py-1.5 font-medium text-text-secondary ${i === 0 ? "border-l border-border-subtle" : ""} ${isDayGrayed(i) ? dayHeaderGrayClass : ""} ${isTodayColumn(i) ? todayHeaderClass : ""}`}
                    title={isTodayColumn(i) ? "Idag" : undefined}
                  >
                    <div className="flex h-full w-full items-center justify-center text-left text-text-secondary">
                      <div>
                        <div>{label}</div>
                        <div className="text-xs text-text-muted">{dayDates[i]}</div>
                      </div>
                    </div>
                  </th>
                ))}
                <th className="w-[4.5rem] min-w-[4.5rem] px-1 py-1.5" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {customerGroups.length === 0 ? (
                <tr className="border-b border-border-subtle bg-bg-default">
                  <td
                    colSpan={13}
                    className="px-4 py-6 text-center text-xs text-text-secondary"
                  >
                    No customers added. Click &quot;Add customer&quot; to start reporting time.
                  </td>
                </tr>
              ) : (
                <>
                  <tr className="border-b border-border-subtle bg-bg-muted/40 font-medium">
                    <td colSpan={5} className="px-1.5 py-1 text-left text-text-primary" />
                    {totalHoursPerDay.map((h, i) => (
                      <td
                        key={i}
                        className={`h-8 w-[3rem] min-w-[3rem] border-r border-border-subtle p-0 py-1 align-middle ${i === 0 ? "border-l border-border-subtle" : ""} ${isDayGrayed(i) ? (isWeekDayWeekend(i) ? dayCellWeekendGrayClass : dayCellHolidayWeekdayGrayClass) : ""} ${isTodayColumn(i) ? todayColumnClass : ""}`}
                      >
                        <div className="flex h-full w-full items-center justify-center">
                          <span className="text-xs tabular-nums text-text-primary">
                            {h > 0 ? String(h) : ""}
                          </span>
                        </div>
                      </td>
                    ))}
                    <td className="w-[4.5rem] min-w-[4.5rem] px-1 py-1 align-middle">
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="text-xs font-medium tabular-nums text-text-primary">
                          {weekTotalDisplay}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {customerGroups.map((group, groupIndex) => {
                const customer = customerById.get(group.customerId);
                const name = customer?.name ?? "—";
                const color = customer?.color ?? "#3b82f6";

                return (
                  <Fragment key={group.customerId}>
                    {groupIndex === 0 && (
                      <tr aria-hidden>
                        <td colSpan={13} className="h-2 p-0" />
                      </tr>
                    )}
                    <tr className="border-b border-border-subtle bg-bg-muted/40">
                      <td
                        className="w-[4.5rem] min-w-[4.5rem] border-l-[4px] border-solid px-1 py-0.5 align-middle"
                        style={{ borderLeftColor: color }}
                      >
                        <button
                          type="button"
                          aria-label="Add row"
                          title="Add row"
                          onClick={() => addRow(group.customerId)}
                          className="flex h-full w-full cursor-pointer items-center justify-center rounded-sm p-1.5 transition-colors hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </td>
                      <td colSpan={4} className="px-1.5 py-1">
                        <div className="flex w-full min-w-0 items-center font-medium text-text-primary">
                          <span className="min-w-0 truncate">{name}</span>
                        </div>
                      </td>
                      {TIME_REPORT_DAY_LABELS.map((_, i) => (
                        <td
                          key={i}
                          className={`w-[3rem] min-w-[3rem] border-r border-border-subtle px-0.5 py-0.5 ${i === 0 ? "border-l border-border-subtle" : ""} ${isDayGrayed(i) ? (isWeekDayWeekend(i) ? dayCellWeekendGrayClass : dayCellHolidayWeekdayGrayClass) : ""} ${isTodayColumn(i) ? todayColumnClass : ""}`}
                        />
                      ))}
                      <td className="w-[4.5rem] min-w-[4.5rem] px-1 py-0.5 align-middle" />
                    </tr>
                    {group.entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-border-subtle bg-bg-default hover:bg-bg-muted/20"
                        >
                          <td
                            className="w-[4.5rem] min-w-[4.5rem] border-l-[4px] border-solid px-1 py-1"
                            style={{ borderLeftColor: color }}
                          >
                            <div className="flex items-center justify-center gap-0.5">
                              <IconButton
                                aria-label="Add internal comment"
                                title="Add internal comment"
                                onClick={() => openComment(entry.id)}
                                className={entryHasComment(entry) ? "text-brand-signal" : ""}
                              >
                                <MessageSquare
                                  className={`h-3.5 w-3.5 ${entryHasComment(entry) ? "fill-brand-signal stroke-brand-signal" : ""}`}
                                />
                              </IconButton>
                              <IconButton
                                aria-label="Copy row to current week"
                                title="Copy row to current week"
                                onClick={() =>
                                  setCopyRowDialog({
                                    mode: "current-week",
                                    customerId: group.customerId,
                                    entry,
                                  })
                                }
                                disabled={
                                  !entry.projectId ||
                                  !entry.roleId ||
                                  (year === initialYear && week === initialWeek) ||
                                  copyToWeekState === "copying"
                                }
                              >
                                {copyToWeekState === "copying" ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" aria-hidden />
                                )}
                              </IconButton>
                              <IconButton
                                aria-label="Duplicate row"
                                title="Duplicate row (Project + Role)"
                                onClick={() => duplicateRow(group.customerId, entry.id)}
                              >
                                <CopyPlus className="h-3.5 w-3.5" />
                              </IconButton>
                              <IconButton
                                aria-label="Delete entire row"
                                title="Delete entire row"
                                onClick={() => removeEntry(group.customerId, entry.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </IconButton>
                            </div>
                          </td>
                          <td className="w-[140px] min-w-[140px] max-w-[140px] px-1.5 py-1">
                            <div
                              className={`min-w-0 overflow-hidden rounded ${showValidationHighlights && entryHasContent(entry) && !entry.projectId ? "ring-2 ring-red-500 ring-offset-1 ring-offset-bg-default" : ""}`}
                            >
                              <Select
                                value={entry.projectId}
                                onValueChange={(value) => {
                                  setShowValidationHighlights(false);
                                  updateEntryInGroup(group.customerId, entry.id, {
                                    projectId: value,
                                    jiraDevOpsValue: "",
                                    roleId: "",
                                  });
                                  loadTaskOptions(group.customerId, value);
                                }}
                                options={getProjectOptions(group.customerId)}
                                size="sm"
                                variant="filter"
                                placeholder="—"
                                triggerClassName="h-7 w-full min-w-0 max-w-full truncate text-xs"
                                isLoading={Boolean(projectOptionsLoading[group.customerId])}
                              />
                            </div>
                          </td>
                          <td className="w-[140px] min-w-[140px] max-w-[140px] px-1.5 py-1">
                            <div
                              className={`min-w-0 overflow-hidden rounded ${showValidationHighlights && entryHasContent(entry) && !entry.roleId ? "ring-2 ring-red-500 ring-offset-1 ring-offset-bg-default" : ""}`}
                            >
                              <Select
                                value={entry.roleId}
                                onValueChange={(value) => {
                                  setShowValidationHighlights(false);
                                  updateEntryInGroup(group.customerId, entry.id, { roleId: value });
                                }}
                                options={getTaskOptions(group.customerId, entry.projectId)}
                                size="sm"
                                variant="filter"
                                placeholder="—"
                                triggerClassName="h-7 w-full min-w-0 max-w-full truncate text-xs"
                                isLoading={Boolean(
                                  taskOptionsLoading[
                                    taskCacheKey(group.customerId, entry.projectId)
                                  ]
                                )}
                              />
                            </div>
                          </td>
                          <td className="w-[200px] min-w-[200px] max-w-[200px] px-1.5 py-1">
                            <input
                              type="text"
                              value={entry.task ?? ""}
                              onChange={(e) =>
                                updateEntryInGroup(group.customerId, entry.id, {
                                  task: e.target.value,
                                })
                              }
                              className="h-7 w-full min-w-0 rounded border border-form bg-bg-default px-1.5 py-0.5 text-xs text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
                            />
                          </td>
                          <td className="w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] px-1 py-1 align-middle">
                            {entry.jiraDevOpsValue ? (() => {
                              const displayKey = entry.jiraDevOpsValue.replace(
                                /^(jira|devops):/,
                                ""
                              );
                              const opt = entry.projectId
                                ? jiraOptionByProjectAndValue.get(
                                    `${entry.projectId}|${entry.jiraDevOpsValue}`
                                  )
                                : undefined;
                              const desc = opt?.description?.trim();
                              return (
                              <div className="flex items-center gap-0.5 min-w-0">
                                <button
                                  type="button"
                                  onMouseEnter={() => {
                                    if (entry.projectId) void loadJiraDevOpsForProject(entry.projectId);
                                  }}
                                  onClick={() => {
                                    setJiraDevOpsModalValue(entry.jiraDevOpsValue);
                                    setJiraDevOpsModal({ customerId: group.customerId, entryId: entry.id });
                                    if (entry.projectId) loadJiraDevOpsForProject(entry.projectId);
                                  }}
                                  className={`min-w-0 flex-1 truncate cursor-pointer rounded px-1 py-0.5 text-left text-xs ${
                                    entry.jiraDevOpsValue.startsWith("jira:")
                                      ? "text-text-primary"
                                      : "text-brand-signal"
                                  } hover:bg-bg-muted`}
                                  title={jiraDevOpsKeyTooltipTitle(displayKey, opt?.description)}
                                >
                                  {displayKey}
                                </button>
                                {entry.jiraDevOpsValue.startsWith("jira:") && (() => {
                                  const url = opt?.url?.trim();
                                  const key = entry.jiraDevOpsValue.replace(/^jira:/, "");
                                  return url ? (
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="shrink-0 rounded p-0.5 text-text-secondary hover:bg-bg-muted hover:text-brand-signal"
                                      aria-label="Open in Jira"
                                      title={
                                        desc
                                          ? `Open in Jira — ${desc}`
                                          : "Open in Jira"
                                      }
                                    >
                                      <ExternalLink className="h-3.5 w-3.5 stroke-[1.5]" />
                                    </a>
                                  ) : (
                                    <span
                                      className="shrink-0 rounded p-0.5 text-text-muted"
                                      title={key ? `Jira ${key} – no URL in database` : undefined}
                                      aria-hidden
                                    >
                                      <ExternalLink className="h-3.5 w-3.5 stroke-[1.5]" />
                                    </span>
                                  );
                                })()}
                              </div>
                              );
                            })() : (
                              <IconButton
                                aria-label="Add Jira/DevOps"
                                onClick={() => {
                                  setJiraDevOpsModalValue("");
                                  setJiraDevOpsModal({ customerId: group.customerId, entryId: entry.id });
                                  if (entry.projectId) loadJiraDevOpsForProject(entry.projectId);
                                }}
                                disabled={!entry.projectId}
                                title="Add Jira/DevOps"
                              >
                                <Link className="h-3.5 w-3.5" />
                              </IconButton>
                            )}
                          </td>
                          {entry.hours.map((h, dayIndex) => (
                            <EditableHourTd
                              key={dayIndex}
                              dayIndex={dayIndex}
                              entryId={entry.id}
                              value={h}
                              isEditing={
                                editingCell?.scope === "week" &&
                                editingCell.entryId === entry.id &&
                                editingCell.dayIndex === dayIndex
                              }
                              isGray={isDayGrayed(dayIndex)}
                              grayWeekend={isWeekDayWeekend(dayIndex)}
                              isToday={isTodayColumn(dayIndex)}
                              onStartEdit={() =>
                                setEditingCell({ scope: "week", entryId: entry.id, dayIndex })
                              }
                              onCommit={(v) => {
                                const next = [...entry.hours];
                                next[dayIndex] = v;
                                updateEntryInGroup(group.customerId, entry.id, {
                                  hours: next,
                                });
                              }}
                              onBlur={() => setEditingCell(null)}
                            />
                          ))}
                          <td className="w-[4.5rem] min-w-[4.5rem] px-1 py-1" />
                        </tr>
                      ))}
                    <tr aria-hidden>
                      <td colSpan={13} className="h-2 p-0" />
                    </tr>
                  </Fragment>
                );
              })}
                </>
              )}
            </tbody>
          </table>
          ) : (
          <table className="w-full table-fixed border-collapse text-[9px]">
            <colgroup>
              <col style={{ width: "4.5rem" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "calc(7ch + 1.25rem)" }} />
              {monthCalendarDates.map((d) => (
                <col key={d} style={{ width: "1.28rem" }} />
              ))}
              <col style={{ width: "4.5rem" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-border-subtle bg-bg-muted/40">
                <th className="w-[4.5rem] min-w-[4.5rem] px-1 py-1.5" aria-hidden />
                <th className="min-w-0 px-1 py-1.5 text-left font-medium text-text-secondary">
                  Project
                </th>
                <th className="min-w-0 px-1 py-1.5 text-left font-medium text-text-secondary">
                  Role
                </th>
                <th className="min-w-0 px-1 py-1.5 text-left font-medium text-text-secondary">
                  Description
                </th>
                <th
                  className="w-[calc(7ch+1.25rem)] min-w-[calc(7ch+1.25rem)] max-w-[calc(7ch+1.25rem)] px-1 py-1.5 text-center font-medium text-text-secondary"
                  scope="col"
                  title="Jira / DevOps"
                >
                  <Link className="inline-block h-3 w-3 text-text-muted" aria-hidden />
                </th>
                {monthCalendarDates.map((dateStr, dateIdx) => {
                  const d = new Date(dateStr + "T12:00:00");
                  const dow = d.getDay();
                  const label = TIME_REPORT_MONTH_GRID_DOW[dow]!;
                  const longDow =
                    dow === 0
                      ? TIME_REPORT_DAY_LABELS[6]
                      : TIME_REPORT_DAY_LABELS[dow - 1]!;
                  const dom = parseInt(dateStr.slice(8, 10), 10);
                  const isTodayHeader = isMonthDateToday(dateStr);
                  return (
                    <th
                      key={dateStr}
                      className={`min-w-0 border-r border-border-subtle px-0 py-1 font-medium leading-tight text-text-secondary ${dateIdx === 0 ? "border-l border-border-subtle" : ""} ${isMonthDateGrayed(dateStr) ? dayHeaderGrayClass : ""} ${isTodayHeader ? todayHeaderClass : ""}`}
                      title={
                        isTodayHeader
                          ? `Idag — ${longDow} ${dom} (${dateStr})`
                          : `${longDow} ${dom} (${dateStr})`
                      }
                    >
                      <div className="flex flex-col items-center justify-center gap-0.5 px-0.5 py-0.5">
                        <span className="text-[8px] leading-tight">{label}</span>
                        <span className="text-[9px] leading-tight text-text-muted tabular-nums">{dom}</span>
                      </div>
                    </th>
                  );
                })}
                <th className="min-w-0 px-1 py-1.5" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {monthRowsByCustomer.length === 0 ? (
                <tr className="border-b border-border-subtle bg-bg-default">
                  <td
                    colSpan={monthTableColSpan}
                    className="px-4 py-6 text-center text-[10px] text-text-secondary"
                  >
                    No customers added. Click &quot;Add customer&quot; to start reporting time.
                  </td>
                </tr>
              ) : (
                <>
                  <tr className="border-b border-border-subtle bg-bg-muted/40 font-medium">
                    <td colSpan={5} className="px-1 py-0.5 text-left text-text-primary" />
                    {monthDateDayTotals.map((h, dateIdx) => {
                      const dateStr = monthCalendarDates[dateIdx]!;
                      return (
                        <td
                          key={dateStr}
                          className={`h-7 min-w-0 border-r border-border-subtle p-0 py-0.5 align-middle ${dateIdx === 0 ? "border-l border-border-subtle" : ""} ${isMonthDateGrayed(dateStr) ? (isMonthDateWeekend(dateStr) ? dayCellWeekendGrayClass : dayCellHolidayWeekdayGrayClass) : ""} ${isMonthDateToday(dateStr) ? todayColumnClass : ""}`}
                        >
                          <div className="flex h-full w-full items-center justify-center">
                            <span className="truncate text-[9px] tabular-nums text-text-primary">
                              {h > 0 ? String(h) : ""}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="min-w-0 px-0.5 py-0.5 align-middle">
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="text-[9px] font-medium tabular-nums text-text-primary">
                          {monthGridTotalDisplay}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {monthRowsByCustomer.map(({ customerId, rows }, groupIndex) => {
                    const customer = customerById.get(customerId);
                    const name = customer?.name ?? "—";
                    const color = customer?.color ?? "#3b82f6";
                    return (
                      <Fragment key={customerId}>
                        {groupIndex === 0 && (
                          <tr aria-hidden>
                            <td colSpan={monthTableColSpan} className="h-2 p-0" />
                          </tr>
                        )}
                        <tr className="border-b border-border-subtle bg-bg-muted/40">
                          <td
                            className="w-[4.5rem] min-w-[4.5rem] border-l-[4px] border-solid px-0.5 py-0.5 align-middle"
                            style={{ borderLeftColor: color }}
                          >
                            <button
                              type="button"
                              aria-label="Add row"
                              title="Add row"
                              onClick={() => addRow(customerId)}
                              className="flex h-full w-full cursor-pointer items-center justify-center rounded-sm p-1 transition-colors hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </td>
                          <td colSpan={4} className="px-1 py-0.5">
                            <div className="flex w-full min-w-0 items-center font-medium text-text-primary">
                              <span className="min-w-0 truncate text-[10px]">{name}</span>
                            </div>
                          </td>
                          {monthCalendarDates.map((dateStr, dateIdx) => (
                            <td
                              key={dateStr}
                              className={`min-w-0 border-r border-border-subtle px-0.5 py-0.5 ${dateIdx === 0 ? "border-l border-border-subtle" : ""} ${isMonthDateGrayed(dateStr) ? (isMonthDateWeekend(dateStr) ? dayCellWeekendGrayClass : dayCellHolidayWeekdayGrayClass) : ""} ${isMonthDateToday(dateStr) ? todayColumnClass : ""}`}
                            />
                          ))}
                          <td className="min-w-0 px-0.5 py-0.5 align-middle" />
                        </tr>
                        {rows.map((row) => {
                          return (
                            <tr
                              key={row.id}
                              className="border-b border-border-subtle bg-bg-default hover:bg-bg-muted/20"
                            >
                              <td
                                className="w-[4.5rem] min-w-[4.5rem] border-l-[4px] border-solid px-0.5 py-0.5"
                                style={{ borderLeftColor: color }}
                              >
                                <div className="flex items-center justify-center gap-0.5">
                                  <IconButton
                                    aria-label="Add internal comment"
                                    title="Add internal comment"
                                    onClick={() => openCommentMonth(row.id)}
                                    className={
                                      Object.values(row.commentsByDate).some((c) => (c ?? "").trim() !== "")
                                        ? "text-brand-signal"
                                        : ""
                                    }
                                  >
                                    <MessageSquare
                                      className={`h-3 w-3 ${Object.values(row.commentsByDate).some((c) => (c ?? "").trim() !== "") ? "fill-brand-signal stroke-brand-signal" : ""}`}
                                    />
                                  </IconButton>
                                  <IconButton
                                    aria-label="Copy this row to next month"
                                    title="Copy this row to next month"
                                    onClick={() => setCopyRowDialog({ mode: "next-month", row })}
                                    disabled={
                                      !row.projectId || !row.roleId || copyToNextMonthState === "copying"
                                    }
                                  >
                                    {copyToNextMonthState === "copying" ? (
                                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </IconButton>
                                  <IconButton
                                    aria-label="Duplicate row"
                                    title="Duplicate row (Project + Role)"
                                    onClick={() => duplicateRow(row.customerId, row.id)}
                                  >
                                    <CopyPlus className="h-3 w-3" />
                                  </IconButton>
                                  <IconButton
                                    aria-label="Delete entire row"
                                    title="Delete entire row"
                                    onClick={() => removeEntry(row.customerId, row.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </IconButton>
                                </div>
                              </td>
                              <td className="min-w-0 px-1 py-0.5">
                                <div
                                  className={`min-w-0 overflow-hidden rounded ${showValidationHighlights && mergedRowHasContent(row) && !row.projectId ? "ring-2 ring-red-500 ring-offset-1 ring-offset-bg-default" : ""}`}
                                >
                                  <Select
                                    value={row.projectId}
                                    onValueChange={(value) => {
                                      setShowValidationHighlights(false);
                                      updateEntryInGroup(row.customerId, row.id, {
                                        projectId: value,
                                        jiraDevOpsValue: "",
                                        roleId: "",
                                      });
                                      loadTaskOptions(row.customerId, value);
                                    }}
                                    options={getProjectOptions(row.customerId)}
                                    size="sm"
                                    variant="filter"
                                    placeholder="—"
                                    triggerClassName="h-6 w-full min-w-0 max-w-full truncate text-[10px]"
                                    itemClassName="text-[10px] leading-tight"
                                    isLoading={Boolean(projectOptionsLoading[row.customerId])}
                                  />
                                </div>
                              </td>
                              <td className="min-w-0 px-1 py-0.5">
                                <div
                                  className={`min-w-0 overflow-hidden rounded ${showValidationHighlights && mergedRowHasContent(row) && !row.roleId ? "ring-2 ring-red-500 ring-offset-1 ring-offset-bg-default" : ""}`}
                                >
                                  <Select
                                    value={row.roleId}
                                    onValueChange={(value) => {
                                      setShowValidationHighlights(false);
                                      updateEntryInGroup(row.customerId, row.id, { roleId: value });
                                    }}
                                    options={getTaskOptions(row.customerId, row.projectId)}
                                    size="sm"
                                    variant="filter"
                                    placeholder="—"
                                    triggerClassName="h-6 w-full min-w-0 max-w-full truncate text-[10px]"
                                    itemClassName="text-[10px] leading-tight"
                                    isLoading={Boolean(
                                      taskOptionsLoading[
                                        taskCacheKey(row.customerId, row.projectId)
                                      ]
                                    )}
                                  />
                                </div>
                              </td>
                              <td className="min-w-0 px-1 py-0.5">
                                <input
                                  type="text"
                                  value={row.task ?? ""}
                                  onChange={(e) =>
                                    updateEntryInGroup(row.customerId, row.id, {
                                      task: e.target.value,
                                    })
                                  }
                                  className="h-6 w-full min-w-0 rounded border border-form bg-bg-default px-1 py-0.5 text-[10px] text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
                                />
                              </td>
                              <td className="w-[calc(7ch+1.25rem)] min-w-[calc(7ch+1.25rem)] max-w-[calc(7ch+1.25rem)] px-0.5 py-0.5 align-middle">
                                {row.jiraDevOpsValue ? (() => {
                                  const displayKey = row.jiraDevOpsValue.replace(
                                    /^(jira|devops):/,
                                    ""
                                  );
                                  const opt = row.projectId
                                    ? jiraOptionByProjectAndValue.get(
                                        `${row.projectId}|${row.jiraDevOpsValue}`
                                      )
                                    : undefined;
                                  const desc = opt?.description?.trim();
                                  return (
                                  <div className="flex min-w-0 items-center gap-0.5">
                                    <button
                                      type="button"
                                      onMouseEnter={() => {
                                        if (row.projectId) void loadJiraDevOpsForProject(row.projectId);
                                      }}
                                      onClick={() => {
                                        setJiraDevOpsModalValue(row.jiraDevOpsValue);
                                        setJiraDevOpsModal({
                                          customerId: row.customerId,
                                          entryId: row.id,
                                        });
                                        if (row.projectId) loadJiraDevOpsForProject(row.projectId);
                                      }}
                                      className={`min-w-0 max-w-full flex-1 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded px-0.5 py-0.5 text-left text-[10px] leading-tight ${
                                        row.jiraDevOpsValue.startsWith("jira:")
                                          ? "text-text-primary"
                                          : "text-brand-signal"
                                      } hover:bg-bg-muted`}
                                      title={jiraDevOpsKeyTooltipTitle(displayKey, opt?.description)}
                                    >
                                      {displayKey}
                                    </button>
                                    {row.jiraDevOpsValue.startsWith("jira:") && (() => {
                                      const url = opt?.url?.trim();
                                      const key = row.jiraDevOpsValue.replace(/^jira:/, "");
                                      return url ? (
                                        <a
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="shrink-0 self-start rounded p-0.5 text-text-secondary hover:bg-bg-muted hover:text-brand-signal"
                                          aria-label="Open in Jira"
                                          title={
                                            desc
                                              ? `Open in Jira — ${desc}`
                                              : "Open in Jira"
                                          }
                                        >
                                          <ExternalLink className="h-3 w-3 stroke-[1.5]" />
                                        </a>
                                      ) : (
                                        <span
                                          className="shrink-0 self-start rounded p-0.5 text-text-muted"
                                          title={key ? `Jira ${key} – no URL in database` : undefined}
                                          aria-hidden
                                        >
                                          <ExternalLink className="h-3 w-3 stroke-[1.5]" />
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  );
                                })() : (
                                  <IconButton
                                    aria-label="Add Jira/DevOps"
                                    onClick={() => {
                                      setJiraDevOpsModalValue("");
                                      setJiraDevOpsModal({
                                        customerId: row.customerId,
                                        entryId: row.id,
                                      });
                                      if (row.projectId) loadJiraDevOpsForProject(row.projectId);
                                    }}
                                    disabled={!row.projectId}
                                    title="Add Jira/DevOps"
                                  >
                                    <Link className="h-3 w-3" />
                                  </IconButton>
                                )}
                              </td>
                              {monthCalendarDates.map((dateStr, dateIdx) => (
                                <EditableHourTd
                                  key={dateStr}
                                  dayIndex={0}
                                  entryId={row.id}
                                  value={row.hoursByDate[dateStr] ?? 0}
                                  compact
                                  showLeftBorder={dateIdx === 0}
                                  isEditing={
                                    editingCell?.scope === "month" &&
                                    editingCell.rowId === row.id &&
                                    editingCell.dateStr === dateStr
                                  }
                                  isGray={isMonthDateGrayed(dateStr)}
                                  grayWeekend={isMonthDateWeekend(dateStr)}
                                  isToday={isMonthDateToday(dateStr)}
                                  onStartEdit={() =>
                                    setEditingCell({
                                      scope: "month",
                                      rowId: row.id,
                                      dateStr,
                                    })
                                  }
                                  onCommit={(v) => {
                                    setIsDirty(true);
                                    setMonthMergedRows((prev) =>
                                      prev.map((r) =>
                                        r.id !== row.id
                                          ? r
                                          : {
                                              ...r,
                                              hoursByDate: { ...r.hoursByDate, [dateStr]: v },
                                            }
                                      )
                                    );
                                  }}
                                  onBlur={() => setEditingCell(null)}
                                />
                              ))}
                              <td className="min-w-0 px-0.5 py-0.5" />
                            </tr>
                          );
                        })}
                        <tr aria-hidden>
                          <td colSpan={monthTableColSpan} className="h-2 p-0" />
                        </tr>
                      </Fragment>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
          )}
          </div>
          <div className="flex justify-start">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAddCustomerOpen(true)}
            >
              <Plus className="h-4 w-4 shrink-0" />
              Add customer
            </Button>
          </div>
          {addCustomerOpen && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-bg-muted/60 p-1.5 pr-1">
              <span className="text-xs text-text-secondary">Add customer:</span>
              {availableToAdd.length === 0 ? (
                <span className="text-xs text-text-muted">
                  All customers added
                </span>
              ) : (
                availableToAdd.map((c) => (
                  <Button
                    key={c.id}
                    variant="secondary"
                    size="sm"
                    onClick={() => addCustomerGroup(c.id)}
                  >
                    {c.name}
                  </Button>
                ))
              )}
              <IconButton
                aria-label="Close"
                onClick={() => setAddCustomerOpen(false)}
                className="ml-auto shrink-0"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={commentState !== null}
        onOpenChange={(open) => {
          if (!open) setCommentState(null);
        }}
        title="Comments per day"
      >
        <div className="flex flex-col gap-3 pt-2">
          <p className="text-sm text-text-secondary">
            Add a comment for each day. Leave blank for no comment.
          </p>
          <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
            {commentState?.kind === "month"
              ? monthCalendarDates.map((dateStr) => {
                  const d = new Date(dateStr + "T12:00:00");
                  const dow = d.getDay();
                  const label =
                    dow === 0
                      ? TIME_REPORT_DAY_LABELS[6]
                      : TIME_REPORT_DAY_LABELS[dow - 1];
                  const dom = parseInt(dateStr.slice(8, 10), 10);
                  return (
                    <div key={dateStr} className="flex min-w-0 items-start gap-2">
                      <label
                        htmlFor={`comment-month-${dateStr}`}
                        className="w-[4.25rem] shrink-0 pt-1.5 text-left text-xs font-medium tabular-nums text-text-secondary"
                      >
                        {label} {dom}
                      </label>
                      <textarea
                        id={`comment-month-${dateStr}`}
                        value={commentTextsByDate[dateStr] ?? ""}
                        onChange={(e) =>
                          setCommentTextsByDate((prev) => ({
                            ...prev,
                            [dateStr]: e.target.value,
                          }))
                        }
                        disabled={(commentDialogMonthRow?.hoursByDate[dateStr] ?? 0) <= 0}
                        rows={1}
                        className="min-h-8 flex-1 resize-y rounded-lg border border-form bg-bg-default px-2 py-1.5 text-sm text-text-primary disabled:cursor-not-allowed disabled:bg-bg-muted/40 disabled:text-text-muted focus:border-form focus:outline-none focus:ring-2 focus:ring-[var(--color-border-form)] focus:ring-inset"
                      />
                    </div>
                  );
                })
              : TIME_REPORT_DAY_LABELS.map((label, i) => (
                  <div key={i} className="flex min-w-0 items-start gap-2">
                    <label
                      htmlFor={`comment-day-${i}`}
                      className="w-[4.25rem] shrink-0 pt-1.5 text-left text-xs font-medium tabular-nums text-text-secondary"
                    >
                      {label} {commentDialogWeekDayNumbers[i]}
                    </label>
                    <textarea
                      id={`comment-day-${i}`}
                      value={commentTexts[i] ?? ""}
                      onChange={(e) =>
                        setCommentTexts((prev) => ({ ...prev, [i]: e.target.value }))
                      }
                      disabled={(commentDialogWeekEntry?.hours[i] ?? 0) <= 0}
                      rows={1}
                      className="min-h-8 flex-1 resize-y rounded-lg border border-form bg-bg-default px-2 py-1.5 text-sm text-text-primary disabled:cursor-not-allowed disabled:bg-bg-muted/40 disabled:text-text-muted focus:border-form focus:outline-none focus:ring-2 focus:ring-[var(--color-border-form)] focus:ring-inset"
                    />
                  </div>
                ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCommentState(null)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={saveComment}>
              Save
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={jiraDevOpsModal !== null}
        onOpenChange={(open) => {
          if (!open) setJiraDevOpsModal(null);
        }}
        title="Jira / DevOps"
      >
        {jiraDevOpsModal && (() => {
          const entry = entryById.get(jiraDevOpsModal.entryId);
          if (!entry) return null;
          const jiraBusy = Boolean(
            entry.projectId && jiraOptionsLoading[entry.projectId]
          );
          return (
            <div className="flex flex-col gap-3 pt-2">
              {jiraBusy ? (
                <div
                  className="flex items-center gap-2 py-6 text-sm text-text-secondary"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Laddar Jira/DevOps…
                </div>
              ) : (
                <Combobox
                  value={jiraDevOpsModalValue}
                  onValueChange={(value) => setJiraDevOpsModalValue(value)}
                  options={getJiraDevOpsOptions(entry.projectId)}
                  placeholder="Type to search..."
                  size="sm"
                  variant="filter"
                  inputClassName="h-9 w-full"
                  emptyOptionsPlaceholder="No Jira/DevOps"
                  renderListInPortal={false}
                />
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setJiraDevOpsModal(null)}
                >
                  Avbryt
                </Button>
                <Button
                  size="sm"
                  disabled={jiraBusy}
                  onClick={() => {
                    updateEntryInGroup(jiraDevOpsModal.customerId, jiraDevOpsModal.entryId, {
                      jiraDevOpsValue: jiraDevOpsModalValue,
                    });
                    setJiraDevOpsModal(null);
                  }}
                >
                  OK
                </Button>
              </div>
            </div>
          );
        })()}
      </Dialog>

      <Dialog
        open={copyRowDialog !== null}
        onOpenChange={(open) => {
          if (!open) setCopyRowDialog(null);
        }}
        title={
          copyRowDialog?.mode === "next-month"
            ? "Copy row to next month"
            : "Copy row to current week"
        }
      >
        {copyRowDialog
          ? (() => {
              const d = copyRowDialog;
              const copyDialogBusy =
                d.mode === "current-week"
                  ? copyToWeekState === "copying"
                  : copyToNextMonthState === "copying";
              const hasHoursToCopy =
                d.mode === "current-week"
                  ? entryHasContent(d.entry)
                  : mergedRowHasContent(d.row);
              const { y: nextCopyY, m: nextCopyM } = nextCalendarMonth(displayYear, displayMonth);
              const nextMonthLabel = new Date(nextCopyY, nextCopyM - 1, 1).toLocaleDateString(
                "en-US",
                { month: "long", year: "numeric" }
              );
              return (
                <div className="flex flex-col gap-3 pt-2">
                  <p className="text-sm text-text-secondary">
                    {d.mode === "current-week" ? (
                      <>
                        Choose whether to include reported hours and internal comments in the
                        current calendar week (W{initialWeek} {initialYear}), or only project, role,
                        description, and Jira/DevOps with empty cells.
                      </>
                    ) : (
                      <>
                        Choose whether to include reported hours and internal comments in the next
                        calendar month ({nextMonthLabel}), or only project, role, description, and
                        Jira/DevOps with empty cells.
                      </>
                    )}
                  </p>
                  {!hasHoursToCopy && (
                    <p className="text-xs text-text-muted">
                      This row has no hours or comments, so only &quot;Rows only&quot; is available.
                    </p>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="sm:mr-auto"
                      onClick={() => setCopyRowDialog(null)}
                      disabled={copyDialogBusy}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (d.mode === "current-week") {
                          void performCopyRowToCurrentWeek(d.customerId, d.entry, false);
                        } else {
                          void performCopyMergedRowToNextMonth(d.row, false);
                        }
                      }}
                      disabled={copyDialogBusy}
                    >
                      Rows only (no hours)
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        if (d.mode === "current-week") {
                          void performCopyRowToCurrentWeek(d.customerId, d.entry, true);
                        } else {
                          void performCopyMergedRowToNextMonth(d.row, true);
                        }
                      }}
                      disabled={!hasHoursToCopy || copyDialogBusy}
                    >
                      Include hours and comments
                    </Button>
                  </div>
                </div>
              );
            })()
          : null}
      </Dialog>
    </div>
  );
}
