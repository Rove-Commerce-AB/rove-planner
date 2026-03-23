"use client";

import { useState, useCallback, useEffect, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, X, Copy, Link, ExternalLink } from "lucide-react";
import { getActiveProjectsForCustomer, getJiraDevOpsOptionsForProject, getTaskOptionsForCustomerAndProject, getHolidayDatesForWeek, getTimeReportEntries, saveTimeReportEntries, copyEntryToWeek, type ProjectOption, type JiraDevOpsOption, type TaskOption } from "./actions";
import { Button, Select, Combobox, Dialog, IconButton } from "@/components/ui";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Local date helpers so this client component never imports dateUtils (avoids SSR bundle issues). */
function getISOWeekDateRangeLocal(year: number, week: number): { start: string; end: string } {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const yearStartMonday = new Date(jan4);
  yearStartMonday.setDate(jan4.getDate() - dayOfWeek + 1);
  const weekStart = new Date(yearStartMonday);
  weekStart.setDate(yearStartMonday.getDate() + (week - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const toYMD = (d: Date) =>
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0");
  return { start: toYMD(weekStart), end: toYMD(weekEnd) };
}
function getYearWeekForDateLocal(date: Date): { year: number; week: number } {
  const isoDay = date.getDay() || 7;
  const thursdayOffset = 4 - isoDay;
  const thursday = new Date(date);
  thursday.setDate(date.getDate() + thursdayOffset);
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(4 - jan4Day + 1);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const week =
    1 + Math.floor((thursday.getTime() - week1Monday.getTime()) / msPerWeek);
  return { year, week };
}
function isoWeeksInYearLocal(year: number): number {
  const dec28 = new Date(year, 11, 28);
  const isoDay = dec28.getDay() || 7;
  const thursdayOffset = 4 - isoDay;
  const thursday = new Date(dec28);
  thursday.setDate(dec28.getDate() + thursdayOffset);
  const isoYear = thursday.getFullYear();
  const jan4 = new Date(isoYear, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - jan4Day + 1);
  return (
    1 +
    Math.floor(
      (thursday.getTime() - week1Monday.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )
  );
}
function addWeeksToYearWeekLocal(
  year: number,
  week: number,
  delta: number
): { year: number; week: number } {
  let w = week + delta;
  let y = year;
  while (w > isoWeeksInYearLocal(y)) {
    w -= isoWeeksInYearLocal(y);
    y += 1;
  }
  while (w < 1) {
    y -= 1;
    w += isoWeeksInYearLocal(y);
  }
  return { year: y, week: w };
}
function getWeeksInMonthLocal(month: number, year: number): { year: number; week: number }[] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const start = getYearWeekForDateLocal(first);
  const end = getYearWeekForDateLocal(last);
  const list: { year: number; week: number }[] = [];
  let y = start.year;
  let w = start.week;
  const endY = end.year;
  const endW = end.week;
  while (y < endY || (y === endY && w <= endW)) {
    list.push({ year: y, week: w });
    w += 1;
    if (w > isoWeeksInYearLocal(y)) {
      w = 1;
      y += 1;
    }
  }
  return list;
}

type Entry = {
  id: string;
  projectId: string;
  roleId: string;
  jiraDevOpsValue: string;
  task: string;
  hours: number[];
  comments: Record<number, string>;
};

type CustomerGroup = {
  customerId: string;
  entries: Entry[];
};

function newEntry(): Entry {
  return {
    id: crypto.randomUUID(),
    projectId: "",
    roleId: "",
    jiraDevOpsValue: "",
    task: "",
    hours: [0, 0, 0, 0, 0, 0, 0],
    comments: {},
  };
}

function cloneGroupsWithNewIds(groups: CustomerGroup[]): CustomerGroup[] {
  return groups.map((g) => ({
    customerId: g.customerId,
    entries: g.entries.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      task: e.task ?? "",
      hours: [...e.hours],
      comments: { ...e.comments },
    })),
  }));
}

function entryHasContent(entry: Entry): boolean {
  const hasHours = entry.hours.some((h) => (h ?? 0) > 0);
  const hasComment = Object.values(entry.comments).some((c) => (c ?? "").trim() !== "");
  return hasHours || hasComment;
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

function taskCacheKey(customerId: string, projectId: string) {
  return `${customerId}-${projectId || ""}`;
}

function groupTotalHours(entries: Entry[]): number {
  return entries.reduce(
    (sum, e) => sum + e.hours.reduce((s, h) => s + h, 0),
    0
  );
}

function dayTotals(entries: Entry[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const e of entries) {
    e.hours.forEach((h, i) => { out[i] += h; });
  }
  return out;
}

/** Inline-edit cell for one day: display value or input on edit. */
function HourCell({
  value,
  isEditing,
  onStartEdit,
  onCommit,
  onBlur,
}: {
  value: number;
  entryId: string;
  dayIndex: number;
  isEditing: boolean;
  onStartEdit: () => void;
  onCommit: (v: number) => void;
  onBlur: () => void;
}) {
  const [localValue, setLocalValue] = useState(String(value || ""));

  useEffect(() => {
    if (isEditing) setLocalValue(value === 0 ? "" : String(value));
  }, [isEditing, value]);

  const handleCommit = () => {
    const num = localValue === "" ? 0 : Math.max(0, Math.min(24, parseFloat(localValue) || 0));
    onCommit(num);
    setLocalValue(num === 0 ? "" : String(num));
    onBlur();
  };

  if (isEditing) {
    return (
      <input
        type="number"
        min={0}
        max={24}
        step={0.5}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCommit();
          if (e.key === "Escape") {
            setLocalValue(value === 0 ? "" : String(value));
            onBlur();
          }
        }}
        autoFocus
        className="h-7 w-9 rounded border border-form bg-bg-default px-0.5 text-right text-xs tabular-nums text-text-primary focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    );
  }

  const display = value === 0 ? "" : String(value);
  return (
    <span className="inline-flex h-7 shrink-0 items-center text-xs tabular-nums text-text-primary">
      {display}
    </span>
  );
}

/** YYYY-MM-DD for Mon..Sun of the given ISO week. */
function getWeekDates(year: number, week: number): string[] {
  const { start } = getISOWeekDateRangeLocal(year, week);
  const monday = new Date(start + "T12:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  });
}

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
  const [jiraDevOpsCache, setJiraDevOpsCache] = useState<Record<string, JiraDevOpsOption[]>>({});
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
  const [showValidationHighlights, setShowValidationHighlights] = useState(false);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRequestIdRef = useRef(0);
  const weekLoadRequestIdRef = useRef(0);
  const [displayMonth, setDisplayMonth] = useState(() => {
    const { start } = getISOWeekDateRangeLocal(initialYear, initialWeek);
    return parseInt(start.slice(5, 7), 10);
  });
  const [displayYear, setDisplayYear] = useState(() => {
    const { start } = getISOWeekDateRangeLocal(initialYear, initialWeek);
    return parseInt(start.slice(0, 4), 10);
  });
  useEffect(() => {
    if (!calendarId) return;
    getHolidayDatesForWeek(calendarId, year, week).then(setHolidayDates);
  }, [calendarId, year, week]);

  useEffect(() => {
    if (!consultant) return;

    const hydrateCachesForGroups = (groups: CustomerGroup[]) => {
      groups.forEach((g) => {
        loadProjectsForCustomer(g.customerId);
        g.entries.forEach((e) => {
          if (e.projectId) {
            loadTaskOptions(g.customerId, e.projectId);
            loadJiraDevOpsForProject(e.projectId);
          }
        });
      });
    };

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
        hydrateCachesForGroups(groups);
      })
      .catch(() => {
        if (requestId !== weekLoadRequestIdRef.current) return;
        setLoadState("loaded");
      });
  }, [consultant?.id, year, week]);

  useEffect(() => {
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }
    if (!isDirty || !consultant) return;

    // Debounce autosave to avoid one request per keystroke.
    saveDebounceRef.current = setTimeout(() => {
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
        })
        .catch(() => {
          if (requestId !== saveRequestIdRef.current) return;
          setSaveState("error");
          setSaveError("Save failed");
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
      if (window.confirm("Du har osparade ändringar. Vill du lämna sidan?")) {
        const path = href.startsWith("/") ? href : new URL(href, window.location.origin).pathname;
        router.push(path);
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isDirty, router]);

  const weekDates = getWeekDates(year, week);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isTodayColumn = (dayIndex: number) => weekDates[dayIndex] === todayStr;

  const isDayGrayed = (dayIndex: number) => {
    const isWeekend = dayIndex === 5 || dayIndex === 6;
    const isHoliday = holidayDates.includes(weekDates[dayIndex]);
    return isWeekend || isHoliday;
  };

  const dayCellGrayClass = "bg-bg-muted/50";
  const dayHeaderGrayClass = "bg-bg-muted/70 text-text-muted";
  const todayColumnClass = "bg-brand-signal/5";
  const todayHeaderClass = "bg-brand-signal/10";

  const goPrevWeek = () => {
    const next = addWeeksToYearWeekLocal(year, week, -1);
    setYear(next.year);
    setWeek(next.week);
  };

  const goNextWeek = () => {
    const next = addWeeksToYearWeekLocal(year, week, 1);
    setYear(next.year);
    setWeek(next.week);
  };

  const goPrevMonth = () => {
    let newMonth = displayMonth - 1;
    let newYear = displayYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    setDisplayMonth(newMonth);
    setDisplayYear(newYear);
    const weeks = getWeeksInMonthLocal(newMonth, newYear);
    if (weeks.length > 0) {
      setYear(weeks[0].year);
      setWeek(weeks[0].week);
    }
  };

  const goNextMonth = () => {
    let newMonth = displayMonth + 1;
    let newYear = displayYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setDisplayMonth(newMonth);
    setDisplayYear(newYear);
    const weeks = getWeeksInMonthLocal(newMonth, newYear);
    if (weeks.length > 0) {
      setYear(weeks[0].year);
      setWeek(weeks[0].week);
    }
  };

  const customerOptionsForSelect = [
    { value: "", label: "—" },
    ...customers.map((c) => ({ value: c.id, label: c.name })),
  ];

  const availableToAdd = customers.filter(
    (c) => !customerGroups.some((g) => g.customerId === c.id)
  );

  const loadProjectsForCustomer = useCallback(async (customerId: string) => {
    if (!customerId) return;
    if (projectCache[customerId] !== undefined) return;
    const list = await getActiveProjectsForCustomer(customerId);
    setProjectCache((prev) =>
      prev[customerId] !== undefined ? prev : { ...prev, [customerId]: list }
    );
  }, [projectCache]);

  const loadTaskOptions = useCallback(async (customerId: string, projectId: string) => {
    const key = taskCacheKey(customerId, projectId);
    if (!customerId) return;
    if (taskCache[key] !== undefined) return;
    const list = await getTaskOptionsForCustomerAndProject(customerId, projectId || undefined);
    setTaskCache((prev) => (prev[key] !== undefined ? prev : { ...prev, [key]: list }));
  }, [taskCache]);

  const loadJiraDevOpsForProject = useCallback(async (projectId: string) => {
    if (!projectId) return;
    if (jiraDevOpsCache[projectId] !== undefined) return;
    const list = await getJiraDevOpsOptionsForProject(projectId);
    setJiraDevOpsCache((prev) =>
      prev[projectId] !== undefined ? prev : { ...prev, [projectId]: list }
    );
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
    const c = customers.find((x) => x.id === customerId);
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
    const group = customerGroups.find((g) => g.entries.some((e) => e.id === entryId));
    const entry = group?.entries.find((e) => e.id === entryId);
    const texts: Record<number, string> = {};
    for (let i = 0; i < 7; i++) {
      texts[i] = entry?.comments[i]?.trim() ?? "";
    }
    setCommentTexts(entry ? texts : {});
    setCommentState({ entryId });
  };

  const saveComment = () => {
    if (!commentState) return;
    const customerId = customerGroups.find((g) =>
      g.entries.some((e) => e.id === commentState.entryId)
    )?.customerId;
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

  const weekTotalHours = customerGroups.reduce(
    (sum, g) => sum + groupTotalHours(g.entries),
    0
  );

  const monthLabel = `${MONTH_NAMES[displayMonth - 1]} ${displayYear}`;
  const monthWeeks = getWeeksInMonthLocal(displayMonth, displayYear);

  const totalHoursPerDay = customerGroups.reduce<number[]>(
    (acc, g) => {
      const daily = dayTotals(g.entries);
      daily.forEach((h, i) => { acc[i] = (acc[i] ?? 0) + h; });
      return acc;
    },
    [0, 0, 0, 0, 0, 0, 0]
  );

  if (!consultant) {
    return (
      <div className="rounded-lg border border-border-subtle bg-bg-muted p-6 text-center text-text-secondary">
        Link your user to a consultant to report time.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center justify-center gap-2">
            <IconButton
              aria-label="Föregående månad"
              onClick={goPrevMonth}
            >
              <ChevronLeft className="h-5 w-5" />
            </IconButton>
            <span className="min-w-[120px] text-center text-sm font-medium text-text-primary">
              {monthLabel}
            </span>
            <IconButton
              aria-label="Nästa månad"
              onClick={goNextMonth}
            >
              <ChevronRight className="h-5 w-5" />
            </IconButton>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-left text-xs font-medium text-text-secondary">
              Current week
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {monthWeeks.map(({ year: wY, week: w }) => {
                const isSelected = wY === year && w === week;
                const isCurrentWeek = wY === initialYear && w === initialWeek;
                return (
                  <button
                    key={`${wY}-${w}`}
                    type="button"
                    onClick={() => {
                      setYear(wY);
                      setWeek(w);
                    }}
                    className={`w-[4.5rem] cursor-pointer shrink-0 rounded-md px-2 py-1 text-center text-xs font-medium transition-colors whitespace-nowrap ${
                      isSelected
                        ? "bg-brand-signal text-white"
                        : "bg-bg-muted text-text-secondary hover:bg-bg-muted/80 hover:text-text-primary"
                    } ${!isSelected && isCurrentWeek ? "ring-2 ring-brand-signal ring-offset-1 ring-offset-bg-default" : ""}`}
                    aria-label={`Vecka ${w}${isCurrentWeek ? " (current week)" : ""}`}
                    aria-pressed={isSelected}
                    title={isCurrentWeek ? "Current week" : undefined}
                  >
                    V {w}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saveState === "saving" && (
            <span className="text-sm text-text-secondary">Saving…</span>
          )}
          {saveState === "error" && saveError && (
            <span className="text-sm text-red-600" role="alert">
              {saveError}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAddCustomerOpen(true)}
          >
            <Plus className="h-4 w-4 shrink-0" />
            Add customer
          </Button>
        </div>
      </div>

      {addCustomerOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-bg-muted p-2 pr-1">
          <span className="text-sm text-text-secondary">Add customer:</span>
          {availableToAdd.length === 0 ? (
            <span className="text-sm text-text-muted">
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

      {loadState === "loading" ? (
        <div className="rounded-lg border border-border-subtle bg-bg-muted p-8 text-center">
          <p className="text-text-secondary">Loading time report…</p>
        </div>
      ) : customerGroups.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-bg-muted p-8 text-center">
          <p className="text-text-secondary">
            No customers added. Click &quot;Add customer&quot; to start reporting time.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-lg border border-border-subtle">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-muted">
                <th className="w-[140px] min-w-[140px] max-w-[140px] px-2 py-2 text-left font-medium text-text-secondary">
                  Project
                </th>
                <th className="w-[140px] min-w-[140px] max-w-[140px] px-2 py-2 text-left font-medium text-text-secondary">
                  Role
                </th>
                <th className="w-[200px] min-w-[200px] max-w-[200px] px-2 py-2 text-left font-medium text-text-secondary">
                  Description
                </th>
                <th className="w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] px-1 py-2 text-center font-medium text-text-secondary" scope="col" title="Jira / DevOps">
                  <Link className="inline-block h-4 w-4 text-text-muted" aria-hidden />
                </th>
                {DAY_LABELS.map((label, i) => (
                  <th
                    key={i}
                    className={`w-[3rem] min-w-[3rem] border-r border-border-subtle p-0 py-2 font-medium text-text-secondary last:border-r-0 ${i === 0 ? "border-l border-border-subtle" : ""} ${isDayGrayed(i) ? dayHeaderGrayClass : ""} ${isTodayColumn(i) ? todayHeaderClass : ""}`}
                  >
                    <div className="flex h-full w-full items-center justify-center text-left text-text-secondary">
                      <div>
                        <div>{label}</div>
                        <div className="text-xs text-text-muted">{dayDates[i]}</div>
                      </div>
                    </div>
                  </th>
                ))}
                <th className="w-[4.5rem] min-w-[4.5rem] px-1 py-2" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {customerGroups.length > 0 && (
                <tr className="border-b border-border-subtle bg-bg-muted font-medium">
                  <td colSpan={4} className="px-2 py-1.5 text-left text-text-primary">
                    Total
                  </td>
                  {totalHoursPerDay.map((h, i) => (
                    <td
                      key={i}
                      className={`h-10 w-[3rem] min-w-[3rem] border-r border-border-subtle p-0 py-1.5 align-middle last:border-r-0 ${i === 0 ? "border-l border-border-subtle" : ""} ${isDayGrayed(i) ? dayCellGrayClass : ""} ${isTodayColumn(i) ? todayColumnClass : ""}`}
                    >
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="text-xs tabular-nums text-text-primary">
                          {h > 0 ? String(h) : ""}
                        </span>
                      </div>
                    </td>
                  ))}
                  <td className="w-[4.5rem] min-w-[4.5rem] px-1 py-1.5 align-middle" />
                </tr>
              )}
              {customerGroups.map((group) => {
                const customer = customers.find((c) => c.id === group.customerId);
                const name = customer?.name ?? "—";
                const color = customer?.color ?? "#3b82f6";
                const total = groupTotalHours(group.entries);
                const daily = dayTotals(group.entries);

                return (
                  <Fragment key={group.customerId}>
                    <tr className="border-b border-border-subtle bg-bg-muted/70">
                      <td colSpan={4} className="px-2 py-1.5">
                        <div className="flex w-full items-center gap-2 font-medium text-text-primary">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: color }}
                            aria-hidden
                          />
                          <span>{name}</span>
                          <span className="font-normal text-text-muted">
                            {total > 0 ? `${total}h` : ""}
                          </span>
                        </div>
                      </td>
                      {DAY_LABELS.map((_, i) => (
                        <td
                          key={i}
                          className={`w-[3rem] min-w-[3rem] border-r border-border-subtle px-0.5 py-1 last:border-r-0 ${i === 0 ? "border-l border-border-subtle" : ""} ${isDayGrayed(i) ? dayCellGrayClass : ""} ${isTodayColumn(i) ? todayColumnClass : ""}`}
                        />
                      ))}
                      <td className="w-[4.5rem] min-w-[4.5rem] px-1 py-1 align-middle">
                        <div className="flex items-center justify-center">
                          <IconButton
                            aria-label="Add row"
                            onClick={() => addRow(group.customerId)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                    {group.entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-border-subtle bg-bg-default hover:bg-bg-subtle/50"
                        >
                          <td className="w-[140px] min-w-[140px] max-w-[140px] px-2 py-1.5">
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
                                  if (value) loadJiraDevOpsForProject(value);
                                  loadTaskOptions(group.customerId, value);
                                }}
                                options={getProjectOptions(group.customerId)}
                                size="sm"
                                variant="filter"
                                placeholder="—"
                                triggerClassName="h-8 w-full min-w-0 max-w-full truncate"
                              />
                            </div>
                          </td>
                          <td className="w-[140px] min-w-[140px] max-w-[140px] px-2 py-1.5">
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
                                triggerClassName="h-8 w-full min-w-0 max-w-full truncate"
                              />
                            </div>
                          </td>
                          <td className="w-[200px] min-w-[200px] max-w-[200px] px-2 py-1.5">
                            <input
                              type="text"
                              value={entry.task ?? ""}
                              onChange={(e) =>
                                updateEntryInGroup(group.customerId, entry.id, {
                                  task: e.target.value,
                                })
                              }
                              className="h-8 w-full min-w-0 rounded border border-form bg-bg-default px-2 py-1 text-sm text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
                            />
                          </td>
                          <td className="w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] px-1 py-1.5 align-middle">
                            {entry.jiraDevOpsValue ? (
                              <div className="flex items-center gap-0.5 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setJiraDevOpsModalValue(entry.jiraDevOpsValue);
                                    setJiraDevOpsModal({ customerId: group.customerId, entryId: entry.id });
                                    if (entry.projectId) loadJiraDevOpsForProject(entry.projectId);
                                  }}
                                  className="min-w-0 flex-1 truncate cursor-pointer rounded px-1 py-0.5 text-left text-xs text-brand-signal hover:bg-bg-muted"
                                  title={`${entry.jiraDevOpsValue.replace(/^(jira|devops):/, "")} – Change Jira/DevOps`}
                                >
                                  {entry.jiraDevOpsValue.replace(/^(jira|devops):/, "")}
                                </button>
                                {entry.jiraDevOpsValue.startsWith("jira:") && (() => {
                                  const opt = getJiraDevOpsOptions(entry.projectId).find((o) => o.value === entry.jiraDevOpsValue);
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
                            <td
                              key={dayIndex}
                              className={`relative h-10 w-[3rem] min-w-[3rem] border-r border-border-subtle p-0 align-middle last:border-r-0 ${dayIndex === 0 ? "border-l border-border-subtle" : ""} ${isDayGrayed(dayIndex) ? dayCellGrayClass : ""} ${isTodayColumn(dayIndex) ? todayColumnClass : ""}`}
                            >
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                  editingCell?.entryId === entry.id && editingCell?.dayIndex === dayIndex
                                    ? undefined
                                    : setEditingCell({ entryId: entry.id, dayIndex })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    if (!(editingCell?.entryId === entry.id && editingCell?.dayIndex === dayIndex)) {
                                      setEditingCell({ entryId: entry.id, dayIndex });
                                    }
                                  }
                                }}
                                className={`absolute inset-0 flex items-center justify-center rounded-sm transition-colors ${editingCell?.entryId === entry.id && editingCell?.dayIndex === dayIndex ? "cursor-default" : "cursor-pointer hover:bg-bg-muted/60"}`}
                              >
                                <HourCell
                                  value={h}
                                  entryId={entry.id}
                                  dayIndex={dayIndex}
                                  isEditing={
                                    editingCell?.entryId === entry.id &&
                                    editingCell?.dayIndex === dayIndex
                                  }
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
                              </div>
                            </td>
                          ))}
                          <td className="w-[4.5rem] min-w-[4.5rem] px-1 py-1.5">
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
                    <tr className="border-b border-border-subtle bg-bg-muted/60 text-text-secondary">
                        <td colSpan={4} className="px-2 py-1 text-left text-xs font-medium">
                          Subtotal
                        </td>
                        {daily.map((h, i) => (
                          <td
                            key={i}
                            className={`h-10 w-[3rem] min-w-[3rem] border-r border-border-subtle p-0 py-1 align-middle last:border-r-0 ${i === 0 ? "border-l border-border-subtle" : ""} ${isDayGrayed(i) ? dayCellGrayClass : ""} ${isTodayColumn(i) ? todayColumnClass : ""}`}
                          >
                            <div className="flex h-full w-full items-center justify-center">
                              <span className="text-xs tabular-nums text-text-secondary">
                                {h > 0 ? String(h) : ""}
                              </span>
                            </div>
                          </td>
                        ))}
                        <td className="w-[4.5rem] min-w-[4.5rem] px-1 py-1 align-middle">
                          <div className="flex h-full w-full items-center justify-center">
                            <span className="text-xs font-medium tabular-nums text-text-secondary">
                              {total > 0 ? `Tot: ${total}` : ""}
                            </span>
                          </div>
                        </td>
                      </tr>
                    <tr aria-hidden>
                      <td colSpan={12} className="border-b border-border-default p-0" />
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
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
            {DAY_LABELS.map((label, i) => (
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
          const entry = customerGroups
            .find((g) => g.customerId === jiraDevOpsModal.customerId)
            ?.entries.find((e) => e.id === jiraDevOpsModal.entryId);
          if (!entry) return null;
          return (
            <div className="flex flex-col gap-3 pt-2">
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
