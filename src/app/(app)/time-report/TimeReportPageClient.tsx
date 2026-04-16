"use client";

import { useState, useCallback, useEffect, useRef, Fragment, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, X, Copy, Link, ExternalLink, Loader2 } from "lucide-react";
import { getActiveProjectsForCustomer, getJiraDevOpsOptionsForProject, getTaskOptionsForCustomerAndProject, getHolidayDatesForWeek, getTimeReportMonthTotalHours, getTimeReportEntries, saveTimeReportEntries, copyEntryToWeek, batchHydrateTimeReport } from "./actions";
import type { ProjectOption, JiraDevOpsOption, TaskOption } from "@/types";
import { Button, Select, Combobox, Dialog, IconButton } from "@/components/ui";
import {
  getISOWeekDateRangeLocal,
  addWeeksToYearWeekLocal,
  getWeeksInMonthLocal,
  getWeekDates,
} from "@/lib/timeReportBrowserWeek";
import { TIME_REPORT_DAY_LABELS, TIME_REPORT_MONTH_NAMES } from "./timeReportShared";
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
  isToday: boolean;
  onStartEdit: () => void;
  onCommit: (value: number) => void;
  onBlur: () => void;
};

const EditableHourTd = memo(function EditableHourTd({
  dayIndex,
  entryId,
  value,
  isEditing,
  isGray,
  isToday,
  onStartEdit,
  onCommit,
  onBlur,
}: EditableHourTdProps) {
  return (
    <td
      className={`relative h-8 w-[3rem] min-w-[3rem] border-r border-border-subtle p-0 align-middle ${dayIndex === 0 ? "border-l border-border-subtle" : ""} ${isGray ? "bg-bg-muted/30" : ""} ${isToday ? "bg-brand-blue/10" : ""}`}
    >
      <div
        role="button"
        tabIndex={0}
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
  const [editingCell, setEditingCell] = useState<{ entryId: string; dayIndex: number } | null>(null);
  const [commentState, setCommentState] = useState<{ entryId: string } | null>(null);
  const [commentTexts, setCommentTexts] = useState<Record<number, string>>({});
  const [jiraDevOpsModal, setJiraDevOpsModal] = useState<{
    customerId: string;
    entryId: string;
  } | null>(null);
  const [jiraDevOpsModalValue, setJiraDevOpsModalValue] = useState("");
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [copyToWeekState, setCopyToWeekState] = useState<"idle" | "copying" | "error">("idle");
  const [loadState, setLoadState] = useState<"idle" | "loading" | "loaded">("idle");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [monthTotalHours, setMonthTotalHours] = useState(0);
  const [monthTotalState, setMonthTotalState] = useState<"idle" | "loading" | "error">("idle");
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
    if (!calendarId) return;
    getHolidayDatesForWeek(calendarId, year, week).then(setHolidayDates);
  }, [calendarId, year, week]);

  useEffect(() => {
    if (!consultant) return;

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
  }, [consultant?.id, year, week, runBatchHydrate]);

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
      saveTimeReportEntries(consultant.id, year, week, customerGroups)
        .then((result) => {
          if (requestId !== saveRequestIdRef.current) return;
          if (result.error) {
            setSaveError(result.error);
            setSaveState("error");
            if (result.error.includes("Project and Role")) {
              setShowValidationHighlights(true);
            }
          } else {
            setSaveState("idle");
            setIsDirty(false);
            setShowValidationHighlights(false);
          }
          // #region agent log
          fetch('http://127.0.0.1:7377/ingest/142286f1-190a-49b6-8e1e-854ceb792769',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'97edeb'},body:JSON.stringify({sessionId:'97edeb',runId:'perf-scan-1',hypothesisId:'H3',location:'TimeReportPageClient.tsx:153',message:'time report autosave result',data:{ms:Math.round((performance.now()-saveStart)*100)/100,week,year,groups:customerGroups.length,error:result.error??null},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        })
        .catch(() => {
          if (requestId !== saveRequestIdRef.current) return;
          setSaveState("error");
          setSaveError("Save failed");
          // #region agent log
          fetch('http://127.0.0.1:7377/ingest/142286f1-190a-49b6-8e1e-854ceb792769',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'97edeb'},body:JSON.stringify({sessionId:'97edeb',runId:'perf-scan-1',hypothesisId:'H3',location:'TimeReportPageClient.tsx:160',message:'time report autosave exception',data:{ms:Math.round((performance.now()-saveStart)*100)/100,week,year,groups:customerGroups.length},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        });
    }, 700);

    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = null;
      }
    };
  }, [isDirty, customerGroups, year, week, consultant?.id]);

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
      const isHoliday = holidayDateSet.has(weekDates[dayIndex]);
      return isWeekend || isHoliday;
    },
    [holidayDateSet, weekDates]
  );

  const dayCellGrayClass = "bg-bg-muted/30";
  const dayHeaderGrayClass = "bg-bg-muted/40 text-text-muted";
  const todayColumnClass = "bg-brand-blue/10";
  const todayHeaderClass = "bg-brand-blue/15";

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
    setIsWeekStripTransitioning(true);
    setWeekStripAnimClass("animate-week-strip-out-to-right");
    let newMonth = displayMonth - 1;
    let newYear = displayYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    window.setTimeout(() => {
      setDisplayMonth(newMonth);
      setDisplayYear(newYear);
      const weeks = getWeeksInMonthLocal(newMonth, newYear);
      if (weeks.length > 0) {
        setYear(weeks[0].year);
        setWeek(weeks[0].week);
      }
      setWeekStripAnimClass("animate-week-strip-in-from-left");
      window.setTimeout(() => {
        setWeekStripAnimClass("");
        setIsWeekStripTransitioning(false);
      }, 320);
    }, 280);
  };

  const goNextMonth = async () => {
    if (isWeekStripTransitioning) return;
    const ok = await flushSave();
    if (!ok) return;
    setIsWeekStripTransitioning(true);
    setWeekStripAnimClass("animate-week-strip-out-to-left");
    let newMonth = displayMonth + 1;
    let newYear = displayYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    window.setTimeout(() => {
      setDisplayMonth(newMonth);
      setDisplayYear(newYear);
      const weeks = getWeeksInMonthLocal(newMonth, newYear);
      if (weeks.length > 0) {
        setYear(weeks[0].year);
        setWeek(weeks[0].week);
      }
      setWeekStripAnimClass("animate-week-strip-in-from-right");
      window.setTimeout(() => {
        setWeekStripAnimClass("");
        setIsWeekStripTransitioning(false);
      }, 320);
    }, 280);
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

  const customerOptionsForSelect = [
    { value: "", label: "—" },
    ...customers.map((c) => ({ value: c.id, label: c.name })),
  ];

  const availableToAdd = customers.filter(
    (c) => !customerGroups.some((g) => g.customerId === c.id)
  );
  const customerById = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  );
  const entryById = useMemo(() => {
    const map = new Map<string, Entry>();
    customerGroups.forEach((g) => {
      g.entries.forEach((e) => map.set(e.id, e));
    });
    return map;
  }, [customerGroups]);
  const customerIdByEntryId = useMemo(() => {
    const map = new Map<string, string>();
    customerGroups.forEach((g) => {
      g.entries.forEach((e) => map.set(e.id, g.customerId));
    });
    return map;
  }, [customerGroups]);
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
  };

  const addCustomerGroup = (customerId: string) => {
    if (customerGroups.some((g) => g.customerId === customerId)) return;
    setIsDirty(true);
    setCustomerGroups((prev) => [
      ...prev,
      { customerId, entries: [newEntry()] },
    ]);
    setAddCustomerOpen(false);
    const c = customerById.get(customerId);
    if (c) loadProjectsForCustomer(customerId);
  };

  const copyRowToCurrentWeek = async (customerId: string, entry: Entry) => {
    if (!consultant || !entry.projectId || !entry.roleId) return;
    setCopyToWeekState("copying");
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
      }
    );
    if (result.error) {
      setCopyToWeekState("error");
      setSaveError(result.error);
      return;
    }
    setCopyToWeekState("idle");
    if (year === initialYear && week === initialWeek) {
      getTimeReportEntries(consultant.id, year, week).then((groups) => {
        setCustomerGroups(groups);
        void runBatchHydrate(groups);
      });
    }
  };

  const addRow = (customerId: string) => {
    setIsDirty(true);
    setCustomerGroups((prev) =>
      prev.map((g) =>
        g.customerId !== customerId
          ? g
          : { ...g, entries: [...g.entries, newEntry()] }
      )
    );
  };

  const removeEntry = (customerId: string, entryId: string) => {
    setIsDirty(true);
    setCustomerGroups((prev) =>
      prev
        .map((g) =>
          g.customerId !== customerId
            ? g
            : { ...g, entries: g.entries.filter((e) => e.id !== entryId) }
        )
        .filter((g) => g.entries.length > 0)
    );
    if (editingCell?.entryId === entryId) setEditingCell(null);
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
    setCommentState({ entryId });
  };

  const saveComment = () => {
    if (!commentState) return;
    const customerId = customerIdByEntryId.get(commentState.entryId);
    if (!customerId) return;
    setIsDirty(true);
    const comments: Record<number, string> = {};
    for (let i = 0; i < 7; i++) {
      const t = (commentTexts[i] ?? "").trim();
      if (t) comments[i] = t;
    }
    setCustomerGroups((prev) =>
      prev.map((g) =>
        g.customerId !== customerId
          ? g
          : {
              ...g,
              entries: g.entries.map((e) =>
                e.id !== commentState.entryId ? e : { ...e, comments }
              ),
            }
      )
    );
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

  const monthLabel = useMemo(
    () => `${TIME_REPORT_MONTH_NAMES[displayMonth - 1]} ${displayYear}`,
    [displayMonth, displayYear]
  );
  const monthWeeks = useMemo(
    () => getWeeksInMonthLocal(displayMonth, displayYear),
    [displayMonth, displayYear]
  );
  const monthTotalDisplay = useMemo(() => {
    if (!Number.isFinite(monthTotalHours) || monthTotalHours <= 0) return "0";
    return Math.abs(monthTotalHours - Math.round(monthTotalHours)) < 1e-6
      ? String(Math.round(monthTotalHours))
      : String(Math.round(monthTotalHours * 10) / 10).replace(/\.0$/, "");
  }, [monthTotalHours]);

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
  const totalEntries = useMemo(
    () => customerGroups.reduce((n, g) => n + g.entries.length, 0),
    [customerGroups]
  );

  useEffect(() => {
    if (!consultant) {
      setMonthTotalHours(0);
      setMonthTotalState("idle");
      return;
    }

    let isStale = false;
    setMonthTotalState("loading");
    getTimeReportMonthTotalHours(consultant.id, displayYear, displayMonth)
      .then((total) => {
        if (isStale) return;
        setMonthTotalHours(total);
        setMonthTotalState("idle");
      })
      .catch(() => {
        if (isStale) return;
        setMonthTotalHours(0);
        setMonthTotalState("error");
      });

    return () => {
      isStale = true;
    };
  }, [consultant, displayMonth, displayYear]);

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center justify-center gap-2">
            <span className="min-w-[120px] text-center text-xs font-medium text-text-primary">
              {monthLabel}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <IconButton
                aria-label="Previous month"
                onClick={goPrevMonth}
                disabled={isWeekStripTransitioning}
              >
                <ChevronLeft className="h-5 w-5" />
              </IconButton>
              <div
                className={`flex flex-wrap items-center gap-1.5 ${weekStripAnimClass}`}
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
                      aria-label={`Vecka ${w}${isCurrentWeek ? " (current week)" : ""}`}
                      aria-pressed={isSelected}
                      title={isCurrentWeek ? "Current week" : undefined}
                    >
                      V {w}
                    </button>
                  );
                })}
              </div>
              <IconButton
                aria-label="Next month"
                onClick={goNextMonth}
                disabled={isWeekStripTransitioning}
              >
                <ChevronRight className="h-5 w-5" />
              </IconButton>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="text-xs text-text-secondary">
            Month total hours reported:{" "}
            <span className="font-medium text-text-primary tabular-nums">
              {monthTotalState === "loading" ? "…" : monthTotalDisplay}
            </span>
          </div>
          {saveState === "saving" && (
            <span className="text-xs text-text-secondary">Saving…</span>
          )}
          {saveState === "error" && saveError && (
            <span className="text-xs text-red-600" role="alert">
              {saveError}
            </span>
          )}
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
          <div className="overflow-x-auto rounded-lg">
          <table className="w-full table-fixed border-collapse text-xs">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-muted/40">
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
                    colSpan={12}
                    className="px-4 py-6 text-center text-xs text-text-secondary"
                  >
                    No customers added. Click &quot;Add customer&quot; to start reporting time.
                  </td>
                </tr>
              ) : (
                <>
                  <tr className="border-b border-border-subtle bg-bg-muted/40 font-medium">
                    <td colSpan={4} className="px-1.5 py-1 text-left text-text-primary" />
                    {totalHoursPerDay.map((h, i) => (
                      <td
                        key={i}
                        className={`h-8 w-[3rem] min-w-[3rem] border-r border-border-subtle p-0 py-1 align-middle ${i === 0 ? "border-l border-border-subtle" : ""} ${isDayGrayed(i) ? dayCellGrayClass : ""} ${isTodayColumn(i) ? todayColumnClass : ""}`}
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
                        <td colSpan={12} className="h-2 p-0" />
                      </tr>
                    )}
                    <tr className="border-b border-border-subtle bg-bg-muted/40">
                      <td
                        colSpan={4}
                        className="border-l-[4px] border-solid px-1.5 py-1"
                        style={{ borderLeftColor: color }}
                      >
                        <div className="flex w-full min-w-0 items-center font-medium text-text-primary">
                          <span className="min-w-0 truncate">{name}</span>
                        </div>
                      </td>
                      {TIME_REPORT_DAY_LABELS.map((_, i) => (
                        <td
                          key={i}
                          className={`w-[3rem] min-w-[3rem] border-r border-border-subtle px-0.5 py-0.5 ${i === 0 ? "border-l border-border-subtle" : ""} ${isDayGrayed(i) ? dayCellGrayClass : ""} ${isTodayColumn(i) ? todayColumnClass : ""}`}
                        />
                      ))}
                      <td className="w-[4.5rem] min-w-[4.5rem] px-1 py-0.5 align-middle">
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
                    </tr>
                    {group.entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-border-subtle bg-bg-default hover:bg-bg-muted/20"
                        >
                          <td
                            className="w-[140px] min-w-[140px] max-w-[140px] border-l-[4px] border-solid px-1.5 py-1"
                            style={{ borderLeftColor: color }}
                          >
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
                            {entry.jiraDevOpsValue ? (
                              <div className="flex items-center gap-0.5 min-w-0">
                                <button
                                  type="button"
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
                                  title={`${entry.jiraDevOpsValue.replace(/^(jira|devops):/, "")} – Change Jira/DevOps`}
                                >
                                  {entry.jiraDevOpsValue.replace(/^(jira|devops):/, "")}
                                </button>
                                {entry.jiraDevOpsValue.startsWith("jira:") && (() => {
                                  const opt = jiraOptionByProjectAndValue.get(
                                    `${entry.projectId}|${entry.jiraDevOpsValue}`
                                  );
                                  const url = opt?.url?.trim();
                                  const key = entry.jiraDevOpsValue.replace(/^jira:/, "");
                                  return url ? (
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="shrink-0 rounded p-0.5 text-text-secondary hover:bg-bg-muted hover:text-brand-signal"
                                      aria-label="Open in Jira"
                                      title="Open in Jira"
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
                            ) : (
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
                                editingCell?.entryId === entry.id &&
                                editingCell?.dayIndex === dayIndex
                              }
                              isGray={isDayGrayed(dayIndex)}
                              isToday={isTodayColumn(dayIndex)}
                              onStartEdit={() =>
                                setEditingCell({ entryId: entry.id, dayIndex })
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
                          <td className="w-[4.5rem] min-w-[4.5rem] px-1 py-1">
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
                                onClick={() => copyRowToCurrentWeek(group.customerId, entry)}
                                disabled={!entry.projectId || !entry.roleId || !entryHasContent(entry) || copyToWeekState === "copying"}
                              >
                                <Copy className="h-3.5 w-3.5" />
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
                        </tr>
                      ))}
                    <tr aria-hidden>
                      <td colSpan={12} className="h-2 p-0" />
                    </tr>
                  </Fragment>
                );
              })}
                </>
              )}
            </tbody>
          </table>
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
          <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
            {TIME_REPORT_DAY_LABELS.map((label, i) => (
              <div key={i} className="flex flex-col gap-1">
                <label htmlFor={`comment-day-${i}`} className="text-xs font-medium text-text-secondary">
                  {label} {dayDates[i]}
                </label>
                <textarea
                  id={`comment-day-${i}`}
                  value={commentTexts[i] ?? ""}
                  onChange={(e) =>
                    setCommentTexts((prev) => ({ ...prev, [i]: e.target.value }))
                  }
                  placeholder={`Comment for ${label}...`}
                  rows={1}
                  className="w-full rounded-lg border border-form bg-bg-default px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-form focus:outline-none focus:ring-2 focus:ring-[var(--color-border-form)] focus:ring-inset"
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
    </div>
  );
}
