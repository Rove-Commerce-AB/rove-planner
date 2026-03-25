"use client";

import { useState, Fragment, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { getMonthSpansForWeeks } from "@/lib/dateUtils";
import type { AllocationPageData } from "@/lib/allocationPageTypes";
import { TO_PLAN_CONSULTANT_ID } from "@/lib/allocationPageTypes";
import { Select, Tabs, TabsList, TabsTrigger, PageHeader, Dialog, Button } from "@/components/ui";
import {
  createAllocation,
  updateAllocation,
} from "@/lib/allocationsClient";
import {
  revalidateAllocationPage,
  getAllocationHistory,
  logAllocationHistoryCreate,
  logAllocationHistoryUpdate,
  deleteAllocationWithHistory,
  deleteAllocationsWithHistory,
} from "@/app/(app)/allocation/actions";
import type { AllocationHistoryEntry } from "@/types";
import { AllocationHistoryTable } from "@/components/AllocationHistoryTable";
import {
  buildPerConsultantView,
  buildPerCustomerView,
  buildPerProjectView,
  getProjectProbabilityMap,
  getDisplayHours,
  type ProbabilityDisplay,
  type ProjectVisibility,
} from "@/lib/allocationPageView";
import { allocationCellKey } from "@/lib/allocationCellKey";
import {
  formatAllocationWeekLabel,
  getAllocationCellBgClass,
} from "@/lib/allocationPageDisplay";
import { useAllocationWeekNavigation } from "@/lib/hooks/useAllocationWeekNavigation";
import { useAllocationFilteredData } from "@/lib/hooks/useAllocationFilteredData";
import { AllocationConsultantTables } from "@/components/allocation/AllocationConsultantTables";

export type {
  ProbabilityDisplay,
  ProjectVisibility,
} from "@/lib/allocationPageView";

const AddAllocationModal = dynamic(
  () => import("./AddAllocationModal").then((m) => ({ default: m.AddAllocationModal })),
  { ssr: false }
);

const EditAllocationModal = dynamic(
  () => import("./EditAllocationModal").then((m) => ({ default: m.EditAllocationModal })),
  { ssr: false }
);

const EditAllocationRangeModal = dynamic(
  () =>
    import("./EditAllocationRangeModal").then((m) => ({
      default: m.EditAllocationRangeModal,
    })),
  { ssr: false }
);

/** Customer and project tab content loaded on demand to reduce initial bundle. */
const AllocationCustomerProjectTabs = dynamic(
  () =>
    import("./AllocationCustomerProjectTabs").then((m) => ({
      default: m.AllocationCustomerProjectTabs,
    })),
  { ssr: false }
);

type Props = {
  data: AllocationPageData | null;
  error: string | null;
  year: number;
  weekFrom: number;
  weekTo: number;
  /** Passed from server so first paint matches hydration (avoids jump from current-week highlight). */
  currentYear: number;
  currentWeek: number;
  /** When set, show only the Per consultant table with no header, tabs, or filters (e.g. project detail planning panel). */
  embedMode?: {
    projectId: string;
    rates?: Record<string, number>;
    budgetHours?: number;
    budgetMoney?: number;
  };
  /** When set (embed), week arrows call this instead of router.push for client-side nav without full reload. */
  onWeekRangeChange?: (year: number, weekFrom: number, weekTo: number) => void | Promise<void>;
  /** When true (embed), show loading state on week nav (e.g. disabled arrows or spinner). */
  embedWeekNavLoading?: boolean;
};

export function AllocationPageClient({
  data,
  error,
  year,
  weekFrom,
  weekTo,
  currentYear: currentYearProp,
  currentWeek: currentWeekProp,
  embedMode,
  onWeekRangeChange,
  embedWeekNavLoading = false,
}: Props) {
  const router = useRouter();
  const { getPreviousUrl, getNextUrl, goToPreviousWeeks, goToNextWeeks } =
    useAllocationWeekNavigation(
      router,
      year,
      weekFrom,
      weekTo,
      embedMode,
      onWeekRangeChange
    );
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "consultant" | "customer" | "project" | "history"
  >("consultant");
  const [historyEntries, setHistoryEntries] = useState<AllocationHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addInitialParams, setAddInitialParams] = useState<{
    consultantId?: string;
    consultantName?: string;
    week?: number;
    weekFrom?: number;
    weekTo?: number;
    year: number;
    projectId?: string;
    projectLabel?: string;
  } | null>(null);
  const [cellDragConsultant, setCellDragConsultant] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [cellDragWeekStart, setCellDragWeekStart] = useState<number | null>(null);
  const [cellDragWeekEnd, setCellDragWeekEnd] = useState<number | null>(null);
  const [editingAllocation, setEditingAllocation] = useState<{
    id: string;
    consultantName: string;
    projectName: string;
    customerName: string;
    week: number;
    year: number;
    hours: number;
    roleId: string | null;
    roleName: string;
  } | null>(null);
  const [expandedConsultants, setExpandedConsultants] = useState<Set<string>>(
    new Set()
  );
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(
    new Set()
  );
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set()
  );
  const [teamFilterId, setTeamFilterId] = useState<string | null>(null);
  const [defaultRoleFilterId, setDefaultRoleFilterId] = useState<string | null>(null);
  const [probabilityDisplay, setProbabilityDisplay] = useState<ProbabilityDisplay>("weighted");
  const [projectVisibility, setProjectVisibility] = useState<ProjectVisibility>("all");
  const [showProjectsWithoutBooking, setShowProjectsWithoutBooking] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    customerId: string;
    consultantId: string;
    roleId: string | null;
    weekIndex: number;
    week: number;
    year: number;
    allocationId: string | null;
    otherAllocationIds: string[];
    projectId: string;
    currentHours: number;
  } | null>(null);
  const [editingCellValue, setEditingCellValue] = useState("");
  const [savingCell, setSavingCell] = useState(false);
  const [cellError, setCellError] = useState<string | null>(null);
  const [editingCellConsultant, setEditingCellConsultant] = useState<{
    consultantId: string;
    projectId: string;
    roleId: string | null;
    weekIndex: number;
    week: number;
    year: number;
    allocationId: string | null;
    currentHours: number;
  } | null>(null);
  const [editingCellConsultantValue, setEditingCellConsultantValue] =
    useState("");
  const [savingCellConsultant, setSavingCellConsultant] = useState(false);

  type DeleteBookingItem = { allocationId: string; year: number; week: number };
  const [deleteBookingDialog, setDeleteBookingDialog] = useState<{
    consultantId: string;
    consultantName: string;
    projectId: string;
    projectLabel: string;
    allocations: DeleteBookingItem[];
    selectedAllocationIds: Set<string>;
  } | null>(null);
  const [deletingBooking, setDeletingBooking] = useState(false);
  const [loadingDeleteBooking, setLoadingDeleteBooking] = useState(false);
  const [optimisticCellHours, setOptimisticCellHours] = useState<Record<string, number>>({});
  const preventNextCellClickRef = useRef(false);
  const [projectRowDrag, setProjectRowDrag] = useState<{
    consultantId: string;
    projectId: string;
    roleId: string | null;
    consultantName: string;
    projectLabel: string;
    roleName?: string;
    weekIndexStart: number;
    weekIndexEnd: number;
  } | null>(null);
  const [projectRowDragMoved, setProjectRowDragMoved] = useState(false);
  const [editRangeModalParams, setEditRangeModalParams] = useState<{
    consultantId: string;
    consultantName: string;
    projectId: string;
    projectLabel: string;
    roleId: string | null;
    roleName?: string;
    weeks: { year: number; week: number; allocationId: string | null; currentHours: number }[];
    availableHoursByWeek: number[];
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!data?.allocations) return;
    setOptimisticCellHours((prev) => {
      const next = { ...prev };
      const allocs = data.allocations ?? [];
      for (const key of Object.keys(next)) {
        const parts = key.split("|");
        if (parts.length !== 5) continue;
        const [consultantId, projectId, roleIdPart, yearStr, weekStr] = parts;
        const year = parseInt(yearStr, 10);
        const week = parseInt(weekStr, 10);
        const roleId = roleIdPart === "" ? null : roleIdPart;
        const match = allocs.find(
          (a) =>
            (consultantId === TO_PLAN_CONSULTANT_ID
              ? a.consultant_id == null
              : a.consultant_id === consultantId) &&
            a.project_id === projectId &&
            (a.role_id ?? null) === roleId &&
            a.year === year &&
            a.week === week
        );
        if (match && Number(match.hours) === next[key]) {
          delete next[key];
        }
      }
      return next;
    });
  }, [data]);

  useEffect(() => {
    if (activeTab !== "history") return;
    setHistoryLoading(true);
    getAllocationHistory(100)
      .then(setHistoryEntries)
      .catch(() => setHistoryEntries([]))
      .finally(() => setHistoryLoading(false));
  }, [activeTab]);

  const filteredData = useAllocationFilteredData(
    data,
    teamFilterId,
    defaultRoleFilterId
  );

  const handleSuccess = async () => {
    await revalidateAllocationPage();
    router.refresh();
  };

  const saveCellHours = useCallback(
    async (cell: NonNullable<typeof editingCell>, value: string) => {
      const hours = parseFloat(value.replace(",", "."));
      if (isNaN(hours) || hours < 0) return;
      setCellError(null);
      setSavingCell(true);
      try {
        if (cell.allocationId) {
          if (hours === 0) {
            await deleteAllocationWithHistory(cell.allocationId);
            for (const id of cell.otherAllocationIds) {
              await deleteAllocationWithHistory(id);
            }
          } else {
            await updateAllocation(cell.allocationId, { hours });
            logAllocationHistoryUpdate(cell.allocationId, hours).catch(() => {});
            for (const id of cell.otherAllocationIds) {
              await deleteAllocationWithHistory(id);
            }
          }
        } else {
          if (hours > 0) {
            const created = await createAllocation({
              consultant_id: cell.consultantId,
              project_id: cell.projectId,
              role_id: cell.roleId ?? undefined,
              year: cell.year,
              week: cell.week,
              hours,
            });
            logAllocationHistoryCreate(created.id).catch(() => {});
          }
        }
        await revalidateAllocationPage();
        router.refresh();
        setEditingCell(null);
      } catch (e) {
        setCellError(e instanceof Error ? e.message : "Failed to save");
      } finally {
        setSavingCell(false);
      }
    },
    [router]
  );

  const handleCellInputBlur = useCallback(() => {
    if (!editingCell) return;
    if (editingCellValue.trim() === "") {
      setEditingCell(null);
      return;
    }
    saveCellHours(editingCell, editingCellValue);
  }, [editingCell, editingCellValue, saveCellHours]);

  const handleCellInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (editingCell) {
          saveCellHours(editingCell, editingCellValue);
        }
      }
      if (e.key === "Escape") {
        setEditingCell(null);
      }
    },
    [editingCell, editingCellValue, saveCellHours]
  );

  const saveCellHoursConsultant = useCallback(
    async (
      cell: NonNullable<typeof editingCellConsultant>,
      value: string
    ) => {
      const hours = parseFloat(value.replace(",", "."));
      if (isNaN(hours) || hours < 0) return;
      const cellKey = allocationCellKey(
        cell.consultantId,
        cell.projectId,
        cell.roleId,
        cell.year,
        cell.week
      );
      setOptimisticCellHours((prev) => ({ ...prev, [cellKey]: hours }));
      setEditingCellConsultant(null);
      setSavingCellConsultant(true);
      try {
        if (cell.allocationId) {
          if (hours === 0) {
            await deleteAllocationWithHistory(cell.allocationId);
          } else {
            await updateAllocation(cell.allocationId, { hours });
            logAllocationHistoryUpdate(cell.allocationId, hours).catch(() => {});
          }
        } else {
          if (hours > 0) {
            const created = await createAllocation({
              consultant_id: cell.consultantId === TO_PLAN_CONSULTANT_ID ? null : cell.consultantId,
              project_id: cell.projectId,
              role_id: cell.roleId ?? undefined,
              year: cell.year,
              week: cell.week,
              hours,
            });
            logAllocationHistoryCreate(created.id).catch(() => {});
          }
        }
        await revalidateAllocationPage();
        router.refresh();
        setEditingCellConsultant(null);
      } catch {
        setOptimisticCellHours((prev) => {
          const next = { ...prev };
          delete next[cellKey];
          return next;
        });
      } finally {
        setSavingCellConsultant(false);
      }
    },
    [router]
  );

  const handleCellConsultantInputBlur = useCallback(() => {
    if (!editingCellConsultant) return;
    if (editingCellConsultantValue.trim() === "") {
      setEditingCellConsultant(null);
      return;
    }
    saveCellHoursConsultant(editingCellConsultant, editingCellConsultantValue);
  }, [editingCellConsultant, editingCellConsultantValue, saveCellHoursConsultant]);

  const handleCellConsultantInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (editingCellConsultant) {
          saveCellHoursConsultant(
            editingCellConsultant,
            editingCellConsultantValue
          );
        }
      }
      if (e.key === "Escape") {
        setEditingCellConsultant(null);
      }
    },
    [
      editingCellConsultant,
      editingCellConsultantValue,
      saveCellHoursConsultant,
    ]
  );

  const toggleConsultant = (id: string) => {
    setExpandedConsultants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCustomer = (id: string) => {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  type PerConsultantRow = ReturnType<typeof buildPerConsultantView>[number];
  const internalRowsRef = useRef<PerConsultantRow[]>([]);

  const handleCellDragEnd = useCallback(() => {
    if (
      cellDragConsultant === null ||
      cellDragWeekStart === null ||
      cellDragWeekEnd === null ||
      !data
    )
      return;
    const internalRows = internalRowsRef.current;
    const fromIdx = Math.min(cellDragWeekStart, cellDragWeekEnd);
    const toIdx = Math.max(cellDragWeekStart, cellDragWeekEnd);
    const wFrom = data.weeks[fromIdx];
    const wTo = data.weeks[toIdx];
    if (wFrom && wTo) {
      const project =
        embedMode && data.projects.length > 0 ? data.projects[0] : null;
      setAddInitialParams({
        consultantId: cellDragConsultant.id,
        consultantName: cellDragConsultant.name,
        year: wFrom.year,
        weekFrom: wFrom.week,
        weekTo: wTo.week,
        projectId: project?.id,
        projectLabel: project
          ? `${project.customerName} - ${project.name}`
          : undefined,
      });
      setAddModalOpen(true);
    }
    setCellDragConsultant(null);
    setCellDragWeekStart(null);
    setCellDragWeekEnd(null);
  }, [cellDragConsultant, cellDragWeekStart, cellDragWeekEnd, data, embedMode]);

  useEffect(() => {
    if (cellDragConsultant === null) return;
    const onMouseUp = () => handleCellDragEnd();
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "crosshair";
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [cellDragConsultant, handleCellDragEnd]);

  const handleProjectRowDragEnd = useCallback(() => {
    if (projectRowDrag === null || !data || !projectRowDragMoved) {
      setProjectRowDrag(null);
      setProjectRowDragMoved(false);
      return;
    }
    const internalRows = internalRowsRef.current;
    const row = internalRows.find((r) => r.consultant.id === projectRowDrag.consultantId);
    const pr = row?.projectRows.find((p) => p.projectId === projectRowDrag.projectId);
    if (!row || !pr) {
      setProjectRowDrag(null);
      setProjectRowDragMoved(false);
      return;
    }
    const lo = Math.min(projectRowDrag.weekIndexStart, projectRowDrag.weekIndexEnd);
    const hi = Math.max(projectRowDrag.weekIndexStart, projectRowDrag.weekIndexEnd);
    const weeks: { year: number; week: number; allocationId: string | null; currentHours: number }[] = [];
    const availableHoursByWeek: number[] = [];
    for (let idx = lo; idx <= hi; idx++) {
      const wk = data.weeks[idx];
      if (!wk) continue;
      weeks.push({
        year: wk.year,
        week: wk.week,
        allocationId: pr.weeks[idx]?.cell?.id ?? null,
        currentHours: pr.weeks[idx]?.cell?.hours ?? 0,
      });
      availableHoursByWeek.push(row.consultant.availableHoursByWeek[idx] ?? 0);
    }
    if (weeks.length > 0) {
      preventNextCellClickRef.current = true;
      setEditRangeModalParams({
        consultantId: projectRowDrag.consultantId,
        consultantName: projectRowDrag.consultantName,
        projectId: projectRowDrag.projectId,
        projectLabel: projectRowDrag.projectLabel,
        roleId: projectRowDrag.roleId,
        roleName: projectRowDrag.roleName,
        weeks,
        availableHoursByWeek,
      });
    }
    setProjectRowDrag(null);
    setProjectRowDragMoved(false);
  }, [projectRowDrag, projectRowDragMoved, data]);

  useEffect(() => {
    if (projectRowDrag === null) return;
    const onMouseUp = () => handleProjectRowDragEnd();
    document.addEventListener("mouseup", onMouseUp);
    document.body.classList.add("allocation-project-row-dragging");
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.body.classList.remove("allocation-project-row-dragging");
    };
  }, [projectRowDrag, handleProjectRowDragEnd]);

  const currentYearNum = currentYearProp;
  const currentWeekNum = currentWeekProp;
  const isCurrentWeekHeader = (w: { year: number; week: number }) =>
    mounted && w.year === currentYearNum && w.week === currentWeekNum;

  const renderWeekHeaderCells = (tableKey: string, borderClass = "border-grid-subtle") =>
    (data?.weeks ?? []).map((w) => (
      <th
        key={`${tableKey}-${w.year}-${w.week}`}
        className={`border-r ${borderClass} px-0.5 py-1 text-center text-[10px] font-medium text-text-primary opacity-80 ${
          isCurrentWeekHeader(w) ? "current-week-header bg-brand-signal/20 border-l border-r" : ""
        }`}
      >
        v{w.week}
      </th>
    ));

  if (error) {
    return (
      <div>
        {!embedMode && (
          <h1 className="text-2xl font-bold text-text-primary">Allocation</h1>
        )}
        <p className={embedMode ? "text-danger" : "mt-4 text-danger"}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={embedMode ? "py-4" : "p-6"}>
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-bg-muted" />
        <div className="mb-4 h-4 w-64 animate-pulse rounded bg-bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-bg-default" />
      </div>
    );
  }

  const projectProbabilityMap =
    data && filteredData
      ? getProjectProbabilityMap(filteredData.projects)
      : new Map<string, number>();
  /** On project detail (embed) we always show raw hours and ignore probability. */
  const effectiveProbabilityDisplay = embedMode ? "none" : probabilityDisplay;
  const perConsultant =
    filteredData && data
      ? buildPerConsultantView(
          filteredData,
          effectiveProbabilityDisplay,
          projectVisibility,
          projectProbabilityMap,
          (consultantId, projectId, roleId, year, week) => {
            const key = allocationCellKey(
              consultantId,
              projectId,
              roleId,
              year,
              week
            );
            const raw = optimisticCellHours[key];
            if (raw == null) return undefined;
            const { displayHours } = getDisplayHours(
              raw,
              projectId,
              effectiveProbabilityDisplay,
              projectVisibility,
              projectProbabilityMap
            );
            return displayHours;
          }
        )
      : [];
  const perCustomer =
    filteredData && data
      ? buildPerCustomerView(filteredData, effectiveProbabilityDisplay, projectVisibility, projectProbabilityMap)
      : [];
  const perProject =
    data && filteredData
      ? buildPerProjectView(filteredData, effectiveProbabilityDisplay, projectVisibility, projectProbabilityMap)
      : [];
  const perProjectFiltered =
    showProjectsWithoutBooking
      ? perProject
      : perProject.filter((r) => r.consultantRows.length > 0);
  const perConsultantInternal = perConsultant.filter((r) => !r.consultant.isExternal);
  internalRowsRef.current = perConsultant;
  const perConsultantExternal = perConsultant.filter((r) => r.consultant.isExternal);
  const expandableConsultantIds = new Set(
    perConsultant.filter((r) => r.projectRows.length > 0).map((r) => r.consultant.id)
  );
  const currentWeek = currentWeekProp;
  const currentYear = currentYearProp;
  const monthSpans = getMonthSpansForWeeks(data.weeks);
  const isCurrentWeek = (w: { year: number; week: number }) =>
    mounted && w.year === currentYear && w.week === currentWeek;

  const showConsultantView = !!embedMode || activeTab === "consultant";

  /** Consultants to show in embed mode (To plan row hidden on project detail only). */
  const perConsultantDisplay = perConsultant.filter(
    (r) => r.consultant.id !== TO_PLAN_CONSULTANT_ID
  );
  const perConsultantInternalDisplay = perConsultantInternal.filter(
    (r) => r.consultant.id !== TO_PLAN_CONSULTANT_ID
  );
  /** Week totals (hours) for footer; only used in embed mode. */
  const weekTotalsHours =
    data.weeks.length > 0
      ? data.weeks.map((_, i) =>
          (embedMode ? perConsultantDisplay : perConsultantInternalDisplay).reduce(
            (sum, row) => sum + (row.percentDetailsByWeek?.[i]?.total ?? 0),
            0
          )
        )
      : [];
  const grandTotalHours = weekTotalsHours.reduce((a, b) => a + b, 0);

  /** Week revenue (SEK) when embedMode has rates; computed from displayed project rows × rate per role. */
  let weekTotalsMoney: number[] | null = null;
  let grandTotalMoney = 0;
  if (embedMode?.rates && data) {
    const rates = embedMode.rates;
    const rowsForMoney = embedMode ? perConsultantDisplay : perConsultantInternalDisplay;
    weekTotalsMoney = data.weeks.map((_, weekIndex) => {
      let sum = 0;
      for (const row of rowsForMoney) {
        for (const pr of row.projectRows) {
          const w = pr.weeks[weekIndex];
          const weekKey = data.weeks[weekIndex];
          if (!weekKey || !w) continue;
          const roleId =
            w.cell?.roleId ??
            pr.weeks.find((x) => x.cell?.roleId)?.cell?.roleId ??
            null;
          const cellKey = allocationCellKey(
            row.consultant.id,
            pr.projectId,
            roleId,
            weekKey.year,
            w.week
          );
          const hours =
            optimisticCellHours[cellKey] != null
              ? optimisticCellHours[cellKey]!
              : (w.cell?.displayHours ?? 0);
          const rate = rates[roleId ?? ""] ?? 0;
          sum += hours * rate;
        }
      }
      return sum;
    });
    grandTotalMoney = weekTotalsMoney.reduce((a, b) => a + b, 0);
  }

  return (
    <>
      {!embedMode && (
        <PageHeader
          title="Allocation"
          description="Manage allocations per week"
          className="mb-6"
        />
      )}

      {!embedMode && (mounted ? (
        <Tabs
          value={activeTab}
          onValueChange={(v) =>
            setActiveTab(v as "consultant" | "customer" | "project" | "history")
          }
          className="mb-4"
        >
          <TabsList className="w-full">
            <TabsTrigger value="consultant">Per consultant</TabsTrigger>
            <TabsTrigger value="customer">Per customer</TabsTrigger>
            <TabsTrigger value="project">Per project</TabsTrigger>
            <TabsTrigger value="history" className="ml-auto">
              Allocation history
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : (
        <div className="mb-4 flex w-full gap-2 border-b border-[var(--color-tabs-border)] px-1 py-2" aria-hidden="true">
          <span className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-primary opacity-70">
            Per consultant
          </span>
          <span className="ml-auto px-4 py-2 text-sm text-text-primary opacity-70">
            Allocation history
          </span>
        </div>
      ))}

      {data && !embedMode && (
        <div className="mb-3 flex flex-wrap items-center gap-2 px-2">
          {/* View – how the table is displayed (probability, which project rows) */}
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
            View
          </span>
          <Select
            variant="filter"
            value={probabilityDisplay}
            onValueChange={(v) => setProbabilityDisplay(v as ProbabilityDisplay)}
            options={[
              { value: "weighted", label: "With probability" },
              { value: "none", label: "Without probability" },
            ]}
            className="w-auto min-w-0"
            triggerClassName={`min-w-[180px] ${probabilityDisplay === "weighted" ? "bg-brand-blue/25 text-text-primary" : ""}`}
          />
          <Select
            variant="filter"
            value={projectVisibility}
            onValueChange={(v) => setProjectVisibility(v as ProjectVisibility)}
            options={[
              { value: "all", label: "All projects" },
              { value: "hideNon100", label: "Only show 100%" },
              { value: "hide100", label: "Only show planned" },
            ]}
            className="w-auto min-w-0"
            triggerClassName="min-w-[180px]"
          />
          <span
            className="mx-1 h-4 w-px shrink-0 bg-[var(--color-border-subtle)]"
            aria-hidden
          />
          {/* Filter – which consultants are shown (team, role) */}
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Filter
          </span>
          {data.teams.length > 0 && (
            <Select
              variant="filter"
              value={teamFilterId ?? ""}
              onValueChange={(v) => setTeamFilterId(v ? v : null)}
              options={[
                { value: "", label: "All teams" },
                ...data.teams.map((t) => ({ value: t.id, label: t.name })),
              ]}
              className="w-auto min-w-0"
              triggerClassName="min-w-[160px]"
            />
          )}
          {activeTab !== "history" && data.roles.length > 0 && (
            <Select
              variant="filter"
              value={defaultRoleFilterId ?? ""}
              onValueChange={(v) => setDefaultRoleFilterId(v ? v : null)}
              options={[
                { value: "", label: "All roles" },
                ...data.roles.map((r) => ({ value: r.id, label: r.name })),
              ]}
              className="w-auto min-w-0"
              triggerClassName="min-w-[160px]"
            />
          )}
          {activeTab === "project" && (
            <label className="flex cursor-pointer select-none items-center gap-2">
              <input
                type="checkbox"
                checked={showProjectsWithoutBooking}
                onChange={(e) => setShowProjectsWithoutBooking(e.target.checked)}
                className="rounded border-form"
              />
              <span className="text-sm text-text-primary">
                Show projects without booking
              </span>
            </label>
          )}
        </div>
      )}

      <div className="allocation-tables space-y-8">
          {showConsultantView && (
            <AllocationConsultantTables
              expandableConsultantIds={expandableConsultantIds}
              setExpandedConsultants={setExpandedConsultants}
              year={year}
              weekFrom={weekFrom}
              weekTo={weekTo}
              goToPreviousWeeks={goToPreviousWeeks}
              goToNextWeeks={goToNextWeeks}
              embedWeekNavLoading={embedWeekNavLoading}
              onWeekRangeChange={onWeekRangeChange}
              router={router}
              getPreviousUrl={getPreviousUrl}
              getNextUrl={getNextUrl}
              embedMode={embedMode}
              data={data}
              monthSpans={monthSpans}
              renderWeekHeaderCells={renderWeekHeaderCells}
              perConsultantDisplay={perConsultantDisplay}
              perConsultantInternal={perConsultantInternal}
              perConsultantExternal={perConsultantExternal}
              expandedConsultants={expandedConsultants}
              toggleConsultant={toggleConsultant}
              cellDragConsultant={cellDragConsultant}
              setCellDragConsultant={setCellDragConsultant}
              cellDragWeekStart={cellDragWeekStart}
              setCellDragWeekStart={setCellDragWeekStart}
              cellDragWeekEnd={cellDragWeekEnd}
              setCellDragWeekEnd={setCellDragWeekEnd}
              getAllocationCellBgClassFn={getAllocationCellBgClass}
              isCurrentWeek={isCurrentWeek}
              editingCellConsultant={editingCellConsultant}
              setEditingCellConsultant={setEditingCellConsultant}
              editingCellConsultantValue={editingCellConsultantValue}
              setEditingCellConsultantValue={setEditingCellConsultantValue}
              handleCellConsultantInputBlur={handleCellConsultantInputBlur}
              handleCellConsultantInputKeyDown={handleCellConsultantInputKeyDown}
              savingCellConsultant={savingCellConsultant}
              optimisticCellHours={optimisticCellHours}
              projectRowDrag={projectRowDrag}
              setProjectRowDrag={setProjectRowDrag}
              setProjectRowDragMoved={setProjectRowDragMoved}
              preventNextCellClickRef={preventNextCellClickRef}
              loadingDeleteBooking={loadingDeleteBooking}
              setLoadingDeleteBooking={setLoadingDeleteBooking}
              setDeleteBookingDialog={setDeleteBookingDialog}
              weekTotalsHours={weekTotalsHours}
              grandTotalHours={grandTotalHours}
              weekTotalsMoney={weekTotalsMoney}
              grandTotalMoney={grandTotalMoney}
            />
          )}
          {activeTab === "history" && (
            <AllocationHistoryTable
              entries={historyEntries}
              loading={historyLoading}
            />
          )}
          {(activeTab === "customer" || activeTab === "project") && (
            <AllocationCustomerProjectTabs
              tab={activeTab}
              data={data}
              year={year}
              weekFrom={weekFrom}
              weekTo={weekTo}
              monthSpans={monthSpans}
              isCurrentWeek={isCurrentWeek}
              renderWeekHeaderCells={renderWeekHeaderCells}
              goToPreviousWeeks={goToPreviousWeeks}
              goToNextWeeks={goToNextWeeks}
              getPreviousUrl={getPreviousUrl}
              getNextUrl={getNextUrl}
              router={router}
              expandedCustomers={expandedCustomers}
              toggleCustomer={toggleCustomer}
              perCustomer={perCustomer}
              expandedProjects={expandedProjects}
              toggleProject={toggleProject}
              perProject={perProjectFiltered}
              editingCell={editingCell}
              setEditingCell={setEditingCell}
              editingCellValue={editingCellValue}
              setEditingCellValue={setEditingCellValue}
              handleCellInputBlur={handleCellInputBlur}
              handleCellInputKeyDown={handleCellInputKeyDown}
              savingCell={savingCell}
              cellError={cellError}
              setAddModalOpen={setAddModalOpen}
              setAddInitialParams={setAddInitialParams}
              editingCellConsultant={editingCellConsultant}
              setEditingCellConsultant={setEditingCellConsultant}
              editingCellConsultantValue={editingCellConsultantValue}
              setEditingCellConsultantValue={setEditingCellConsultantValue}
              saveCellHoursConsultant={saveCellHoursConsultant}
              handleCellConsultantInputBlur={handleCellConsultantInputBlur}
              handleCellConsultantInputKeyDown={handleCellConsultantInputKeyDown}
              savingCellConsultant={savingCellConsultant}
              formatWeekLabel={formatAllocationWeekLabel}
            />
          )}
      </div>

      <AddAllocationModal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setAddInitialParams(null);
        }}
        onSuccess={handleSuccess}
        year={year}
        weekFrom={weekFrom}
        weekTo={weekTo}
        initialConsultantId={addInitialParams?.consultantId}
        initialConsultantName={addInitialParams?.consultantName}
        initialWeek={addInitialParams?.week}
        initialYear={addInitialParams?.year}
        initialWeekFrom={addInitialParams?.weekFrom}
        initialWeekTo={addInitialParams?.weekTo}
        initialProjectId={addInitialParams?.projectId}
        initialProjectLabel={addInitialParams?.projectLabel}
      />

      <Dialog
        open={deleteBookingDialog !== null}
        onOpenChange={(open) => !open && setDeleteBookingDialog(null)}
        title="Remove booking"
      >
        {deleteBookingDialog && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-text-primary">
              Remove booking for <strong>{deleteBookingDialog.consultantName}</strong> on{" "}
              <strong>{deleteBookingDialog.projectLabel}</strong>?
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="danger"
                disabled={deletingBooking}
                onClick={async () => {
                  setDeletingBooking(true);
                  try {
                    const ids = deleteBookingDialog.allocations.map((a) => a.allocationId);
                    await deleteAllocationsWithHistory(ids);
                    handleSuccess();
                    setDeleteBookingDialog(null);
                  } finally {
                    setDeletingBooking(false);
                  }
                }}
              >
                Remove entire booking
              </Button>
              <div className="border-t border-panel pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70">
                  Or select weeks to remove
                </p>
                <div className="max-h-48 space-y-1.5 overflow-y-auto">
                  {deleteBookingDialog.allocations.map((a) => (
                    <label
                      key={a.allocationId}
                      className="flex cursor-pointer items-center gap-2 text-sm text-text-primary"
                    >
                      <input
                        type="checkbox"
                        checked={deleteBookingDialog.selectedAllocationIds.has(a.allocationId)}
                        onChange={() => {
                          setDeleteBookingDialog((prev) => {
                            if (!prev) return null;
                            const next = new Set(prev.selectedAllocationIds);
                            if (next.has(a.allocationId)) next.delete(a.allocationId);
                            else next.add(a.allocationId);
                            return { ...prev, selectedAllocationIds: next };
                          });
                        }}
                        className="rounded border-form"
                      />
                      <span>{formatAllocationWeekLabel(a.week, a.year)}</span>
                    </label>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  className="mt-2 border-danger text-danger hover:bg-danger/10"
                  disabled={deletingBooking || deleteBookingDialog.selectedAllocationIds.size === 0}
                  onClick={async () => {
                    const idsToDelete = deleteBookingDialog.allocations
                      .filter((a) => deleteBookingDialog.selectedAllocationIds.has(a.allocationId))
                      .map((a) => a.allocationId);
                    setDeletingBooking(true);
                    try {
                      await deleteAllocationsWithHistory(idsToDelete);
                      handleSuccess();
                      setDeleteBookingDialog(null);
                    } finally {
                      setDeletingBooking(false);
                    }
                  }}
                >
                  Remove selected ({deleteBookingDialog.selectedAllocationIds.size})
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <EditAllocationModal
        allocation={editingAllocation}
        isOpen={editingAllocation !== null}
        onClose={() => setEditingAllocation(null)}
        onSuccess={handleSuccess}
      />

      {editRangeModalParams && (
        <EditAllocationRangeModal
          isOpen={true}
          onClose={() => setEditRangeModalParams(null)}
          onSuccess={(savedHours) => {
            const params = editRangeModalParams;
            if (params) {
              setOptimisticCellHours((prev) => {
                const next = { ...prev };
                if (typeof savedHours === "number") {
                  for (const w of params.weeks) {
                    const key = allocationCellKey(
                      params.consultantId,
                      params.projectId,
                      params.roleId,
                      w.year,
                      w.week
                    );
                    if (savedHours > 0) next[key] = savedHours;
                    else delete next[key];
                  }
                } else {
                  for (const { year, week, hours } of savedHours) {
                    const key = allocationCellKey(
                      params.consultantId,
                      params.projectId,
                      params.roleId,
                      year,
                      week
                    );
                    if (hours > 0) next[key] = hours;
                    else delete next[key];
                  }
                }
                return next;
              });
            }
            router.refresh();
          }}
          consultantId={editRangeModalParams.consultantId}
          consultantName={editRangeModalParams.consultantName}
          projectId={editRangeModalParams.projectId}
          projectLabel={editRangeModalParams.projectLabel}
          roleId={editRangeModalParams.roleId}
          roleName={editRangeModalParams.roleName}
          weeks={editRangeModalParams.weeks}
          availableHoursByWeek={editRangeModalParams.availableHoursByWeek}
        />
      )}
    </>
  );
}
