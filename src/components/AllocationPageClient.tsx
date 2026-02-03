"use client";

import { useState, Fragment, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import {
  getCurrentYearWeek,
  getMonthSpansForWeeks,
  addWeeksToYearWeek,
} from "@/lib/dateUtils";
import type { AllocationPageData } from "@/lib/allocationPage";
import { DEFAULT_CUSTOMER_COLOR } from "@/lib/constants";
import { Select, Tabs, TabsList, TabsTrigger, PageHeader } from "@/components/ui";
import {
  createAllocation,
  updateAllocation,
  deleteAllocation,
} from "@/lib/allocations";
import { AddAllocationModal } from "./AddAllocationModal";
import { EditAllocationModal } from "./EditAllocationModal";

type Props = {
  data: AllocationPageData | null;
  error: string | null;
  year: number;
  weekFrom: number;
  weekTo: number;
};

function buildPerConsultantView(data: AllocationPageData) {
  const roleMap = new Map(data.roles.map((r) => [r.id, r.name]));
  const projectMap = new Map(
    data.projects.map((p) => [
      p.id,
      { name: p.name, customerName: p.customerName, customerColor: p.customerColor },
    ])
  );

  const byConsultant = new Map<
    string,
    Map<string, Map<number, { id: string; hours: number; roleName: string; roleId: string | null }>>
  >();

  for (const a of data.allocations) {
    if (!byConsultant.has(a.consultant_id)) {
      byConsultant.set(
        a.consultant_id,
        new Map()
      );
    }
    const byProject = byConsultant.get(a.consultant_id)!;
    if (!byProject.has(a.project_id)) {
      byProject.set(a.project_id, new Map());
    }
    const byWeek = byProject.get(a.project_id)!;
    byWeek.set(a.week, {
      id: a.id,
      hours: a.hours,
      roleName: a.role_id ? roleMap.get(a.role_id) ?? "Unknown" : "",
      roleId: a.role_id,
    });
  }

  const sortedConsultants = [...data.consultants].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return sortedConsultants.map((c) => {
    const projectsMap = byConsultant.get(c.id);
    const projectRows: { projectId: string; projectName: string; customerName: string; customerColor: string; roleName: string; weeks: { week: number; cell: { id: string; hours: number; roleName: string; roleId: string | null } | null }[] }[] = [];

    if (projectsMap) {
      const rows: (typeof projectRows)[number][] = [];
      for (const [projectId, byWeek] of projectsMap) {
        const proj = projectMap.get(projectId);
        const weeks = data.weeks.map((w) => ({
          week: w.week,
          cell: byWeek.get(w.week) ?? null,
        }));
        const firstCellWithRole = weeks.find((w) => w.cell?.roleName);
        const roleName = firstCellWithRole?.cell?.roleName ?? "";
        rows.push({
          projectId,
          projectName: proj?.name ?? "Unknown",
          customerName: proj?.customerName ?? "",
          customerColor: proj?.customerColor ?? DEFAULT_CUSTOMER_COLOR,
          roleName,
          weeks,
        });
      }
      rows.sort((a, b) => a.projectName.localeCompare(b.projectName));
      projectRows.push(...rows);
    }

    const totalByWeek = new Map<number, number>();
    for (const pr of projectRows) {
      for (const { week, cell } of pr.weeks) {
        if (cell && cell.hours > 0) {
          totalByWeek.set(week, (totalByWeek.get(week) ?? 0) + cell.hours);
        }
      }
    }

    const percentByWeek = data.weeks.map((w, i) => {
      const total = totalByWeek.get(w.week) ?? 0;
      const available = c.availableHoursByWeek[i] ?? c.hoursPerWeek;
      return available > 0 ? Math.round((total / available) * 100) : 0;
    });

    const percentDetailsByWeek = data.weeks.map((w, i) => {
      const total = totalByWeek.get(w.week) ?? 0;
      const available = c.availableHoursByWeek[i] ?? c.hoursPerWeek;
      const pct = available > 0 ? Math.round((total / available) * 100) : 0;
      return { total, available, pct };
    });

    return {
      consultant: c,
      projectRows,
      percentByWeek: percentDetailsByWeek.map((d) => d.pct),
      percentDetailsByWeek,
      totalByWeek,
    };
  });
}

function buildPerCustomerView(data: AllocationPageData) {
  const roleMap = new Map(data.roles.map((r) => [r.id, r.name]));
  const projectMap = new Map(
    data.projects.map((p) => [p.id, { customer_id: p.customer_id, customerName: p.customerName, name: p.name }])
  );

  const ROW_KEY_SEP = "|";
  const keyFor = (consultantId: string, roleId: string | null) =>
    `${consultantId}${ROW_KEY_SEP}${roleId ?? "__none__"}`;

  const byCustomer = new Map<
    string,
    Map<string, Map<number, { id: string; projectId: string; hours: number; roleName: string; roleId: string | null; projectName: string }[]>>
  >();

  for (const a of data.allocations) {
    const proj = projectMap.get(a.project_id);
    if (!proj) continue;
    const customerId = proj.customer_id;
    const projectName = projectMap.get(a.project_id)?.name ?? "Unknown";
    const roleId = a.role_id ?? null;
    const roleName = roleId ? roleMap.get(roleId) ?? "Unknown" : "";
    const rowKey = keyFor(a.consultant_id, roleId);

    if (!byCustomer.has(customerId)) {
      byCustomer.set(customerId, new Map());
    }
    const byConsultantRole = byCustomer.get(customerId)!;
    if (!byConsultantRole.has(rowKey)) {
      byConsultantRole.set(rowKey, new Map());
    }
    const byWeek = byConsultantRole.get(rowKey)!;
    if (!byWeek.has(a.week)) {
      byWeek.set(a.week, []);
    }
    byWeek.get(a.week)!.push({
      id: a.id,
      projectId: a.project_id,
      hours: a.hours,
      roleName,
      roleId,
      projectName,
    });
  }

  const sortedCustomers = [...data.customers].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return sortedCustomers.map((cust) => {
    const byConsultantRole = byCustomer.get(cust.id);
    const consultantRows: {
      consultantId: string;
      consultantName: string;
      roleId: string | null;
      roleName: string;
      weeks: { week: number; cells: { id: string; projectId: string; hours: number; roleName: string; roleId: string | null; projectName: string }[] }[];
    }[] = [];

    if (byConsultantRole) {
      const consultantMap = new Map(data.consultants.map((c) => [c.id, c]));
      const rows: { key: string; consultantId: string; roleId: string | null }[] = [];
      for (const rowKey of byConsultantRole.keys()) {
        const [consultantId, rolePart] = rowKey.split(ROW_KEY_SEP);
        const roleId = rolePart === "__none__" ? null : rolePart;
        rows.push({ key: rowKey, consultantId, roleId });
      }
      rows.sort((a, b) => {
        const nameA = consultantMap.get(a.consultantId)?.name ?? "";
        const nameB = consultantMap.get(b.consultantId)?.name ?? "";
        const nameCmp = nameA.localeCompare(nameB);
        if (nameCmp !== 0) return nameCmp;
        const roleA = a.roleId ? roleMap.get(a.roleId) ?? "" : "";
        const roleB = b.roleId ? roleMap.get(b.roleId) ?? "" : "";
        return roleA.localeCompare(roleB);
      });
      for (const { key: rowKey, consultantId, roleId } of rows) {
        const c = consultantMap.get(consultantId);
        const byWeek = byConsultantRole.get(rowKey);
        const weeks = data.weeks.map((w) => ({
          week: w.week,
          cells: byWeek?.get(w.week) ?? [],
        }));
        consultantRows.push({
          consultantId,
          consultantName: c?.name ?? "Unknown",
          roleId,
          roleName: roleId ? roleMap.get(roleId) ?? "Unknown" : "",
          weeks,
        });
      }
    }

    const totalByWeek = new Map<number, number>();
    for (const cr of consultantRows) {
      for (const { week, cells } of cr.weeks) {
        const sum = cells.reduce((s, x) => s + x.hours, 0);
        if (sum > 0) {
          totalByWeek.set(week, (totalByWeek.get(week) ?? 0) + sum);
        }
      }
    }

    return {
      customer: cust,
      consultantRows,
      totalByWeek,
    };
  });
}

function formatWeekLabel(week: number, year: number) {
  return `v${week} ${year}`;
}

function getAllocationCellBgClass(pct: number): string {
  if (pct === 0) return "bg-bg-muted/20";
  if (pct < 85) return "bg-warning/15";
  if (pct <= 115) return "bg-success/15";
  return "bg-danger/15";
}

export function AllocationPageClient({
  data,
  error,
  year,
  weekFrom,
  weekTo,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"consultant" | "customer">(
    "consultant"
  );
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addInitialParams, setAddInitialParams] = useState<{
    consultantId?: string;
    consultantName?: string;
    week?: number;
    weekFrom?: number;
    weekTo?: number;
    year: number;
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
  const [teamFilterId, setTeamFilterId] = useState<string | null>(null);
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

  const filteredData: AllocationPageData | null =
    data === null
      ? null
      : {
          consultants: data.consultants.filter((c) => {
            if (teamFilterId !== null && c.teamId !== teamFilterId)
              return false;
            return true;
          }),
          projects: data.projects ?? [],
          customers: data.customers ?? [],
          roles: data.roles ?? [],
          teams: data.teams ?? [],
          allocations: data.allocations ?? [],
          year: data.year,
          weekFrom: data.weekFrom,
          weekTo: data.weekTo,
          weeks: data.weeks ?? [],
        };

  const handleSuccess = () => {
    router.refresh();
  };

  const saveCellHours = useCallback(
    async (cell: NonNullable<typeof editingCell>, value: string) => {
      const hours = parseFloat(value.replace(",", "."));
      if (isNaN(hours) || hours < 0) return;
      setSavingCell(true);
      try {
        if (cell.allocationId) {
          await updateAllocation(cell.allocationId, { hours });
          for (const id of cell.otherAllocationIds) {
            await deleteAllocation(id);
          }
        } else {
          if (hours > 0) {
            await createAllocation({
              consultant_id: cell.consultantId,
              project_id: cell.projectId,
              role_id: cell.roleId ?? undefined,
              year: cell.year,
              week: cell.week,
              hours,
            });
          }
        }
        router.refresh();
        setEditingCell(null);
      } catch {
        // Keep editing on error; could show toast
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
      setSavingCellConsultant(true);
      try {
        if (cell.allocationId) {
          await updateAllocation(cell.allocationId, { hours });
        } else {
          if (hours > 0) {
            await createAllocation({
              consultant_id: cell.consultantId,
              project_id: cell.projectId,
              role_id: cell.roleId ?? undefined,
              year: cell.year,
              week: cell.week,
              hours,
            });
          }
        }
        router.refresh();
        setEditingCellConsultant(null);
      } catch {
        // Keep editing on error
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

  const SHIFT_WEEKS = 4;

  const getFirstLastWeek = (): {
    first: { year: number; week: number };
    last: { year: number; week: number };
  } => {
    if (weekFrom <= weekTo) {
      return { first: { year, week: weekFrom }, last: { year, week: weekTo } };
    }
    return {
      first: { year, week: weekFrom },
      last: { year: year + 1, week: weekTo },
    };
  };

  const toUrl = (first: { year: number; week: number }, last: { year: number; week: number }) =>
    `/allocation?year=${first.year}&from=${first.week}&to=${last.week}`;

  const getPreviousUrl = () => {
    const { first, last } = getFirstLastWeek();
    const newFirst = addWeeksToYearWeek(first.year, first.week, -SHIFT_WEEKS);
    const newLast = addWeeksToYearWeek(last.year, last.week, -SHIFT_WEEKS);
    return toUrl(newFirst, newLast);
  };

  const getNextUrl = () => {
    const { first, last } = getFirstLastWeek();
    const newFirst = addWeeksToYearWeek(first.year, first.week, SHIFT_WEEKS);
    const newLast = addWeeksToYearWeek(last.year, last.week, SHIFT_WEEKS);
    return toUrl(newFirst, newLast);
  };

  const goToPreviousWeeks = () => router.push(getPreviousUrl());
  const goToNextWeeks = () => router.push(getNextUrl());

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

  const handleCellDragEnd = useCallback(() => {
    if (
      cellDragConsultant === null ||
      cellDragWeekStart === null ||
      cellDragWeekEnd === null ||
      !data
    )
      return;
    const fromIdx = Math.min(cellDragWeekStart, cellDragWeekEnd);
    const toIdx = Math.max(cellDragWeekStart, cellDragWeekEnd);
    const wFrom = data.weeks[fromIdx];
    const wTo = data.weeks[toIdx];
    if (wFrom && wTo) {
      setAddInitialParams({
        consultantId: cellDragConsultant.id,
        consultantName: cellDragConsultant.name,
        year: data.year,
        weekFrom: wFrom.week,
        weekTo: wTo.week,
      });
      setAddModalOpen(true);
    }
    setCellDragConsultant(null);
    setCellDragWeekStart(null);
    setCellDragWeekEnd(null);
  }, [cellDragConsultant, cellDragWeekStart, cellDragWeekEnd, data]);

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

  const { week: currentWeekNum, year: currentYearNum } = getCurrentYearWeek();
  const isCurrentWeekHeader = (w: { year: number; week: number }) =>
    w.year === currentYearNum && w.week === currentWeekNum;

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
        <h1 className="text-2xl font-bold text-text-primary">Allocation</h1>
        <p className="mt-4 text-danger">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-bg-muted" />
        <div className="mb-4 h-4 w-64 animate-pulse rounded bg-bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-bg-default" />
      </div>
    );
  }

  const perConsultant = buildPerConsultantView(filteredData!);
  const perCustomer = buildPerCustomerView(filteredData!);
  const perConsultantInternal = perConsultant.filter((r) => !r.consultant.isExternal);
  const perConsultantExternal = perConsultant.filter((r) => r.consultant.isExternal);
  const { week: currentWeek, year: currentYear } = getCurrentYearWeek();
  const monthSpans = getMonthSpansForWeeks(data.weeks);
  const isCurrentWeek = (w: { year: number; week: number }) =>
    w.year === currentYear && w.week === currentWeek;

  return (
    <>
      <PageHeader
        title="Allocation"
        description="Manage allocations per week"
        className="mb-6"
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "consultant" | "customer")}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="consultant">Per consultant</TabsTrigger>
          <TabsTrigger value="customer">Per customer</TabsTrigger>
        </TabsList>
      </Tabs>

      {data.teams.length > 0 && (
        <div className="mb-3 w-fit px-2">
          <Select
            value={teamFilterId ?? ""}
            onValueChange={(v) => setTeamFilterId(v ? v : null)}
            options={[
              { value: "", label: "All teams" },
              ...data.teams.map((t) => ({ value: t.id, label: t.name })),
            ]}
            className="w-auto min-w-[120px]"
          />
        </div>
      )}

      <div className="allocation-tables overflow-x-hidden space-y-8">
          {activeTab === "consultant" && (
            <>
              <div className="p-2">
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-text-primary opacity-60">
                    Internal
                  </h3>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] tabular-nums text-text-primary opacity-70">
                      {weekFrom <= weekTo
                        ? `${year} · v${weekFrom}–v${weekTo}`
                        : `${year} v${weekFrom} – ${year + 1} v${weekTo}`}
                    </span>
                    <button
                      type="button"
                      onClick={goToPreviousWeeks}
                      onMouseEnter={() => router.prefetch(getPreviousUrl())}
                      className="rounded-sm p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100"
                      aria-label="Previous weeks"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={goToNextWeeks}
                      onMouseEnter={() => router.prefetch(getNextUrl())}
                      className="rounded-sm p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100"
                      aria-label="Next weeks"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <table className="w-full min-w-0 table-fixed border border-border text-[10px]">
                  <colgroup>
                    <col className="w-[300px]" />
                    {data.weeks.map((w) => (
                      <col key={`${w.year}-${w.week}`} className="w-[1.75rem]" />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-grid-subtle bg-bg-muted/80">
                      <th
                        rowSpan={2}
                        className="border-r border-grid-subtle px-2 py-1 text-left text-[10px] font-medium text-text-primary opacity-80"
                      >
                        Consultant / Project
                      </th>
                      {monthSpans.map((span, i) => (
                        <th
                          key={i}
                          colSpan={span.colSpan}
                          className="border-r border-grid-subtle px-0.5 py-1 text-center text-[10px] font-medium uppercase tracking-wide text-text-primary opacity-60"
                        >
                          {span.label}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b border-grid-subtle bg-bg-muted">
                      {renderWeekHeaderCells("internal")}
                    </tr>
                  </thead>
                  <tbody>
                    {perConsultantInternal.map((row) => {
                const expanded = expandedConsultants.has(row.consultant.id);
                const hasProjects = row.projectRows.length > 0;
                return (
                  <Fragment key={row.consultant.id}>
                    <tr
                      className={`border-b border-grid-light-subtle last:border-border ${expanded && hasProjects ? "shadow-[0_2px_8px_rgba(0,0,0,0.28)]" : ""}`}
                    >
                      <td className="border-r border-grid-light-subtle px-2 py-1.5 align-top">
                        <button
                          type="button"
                          onClick={() =>
                            hasProjects && toggleConsultant(row.consultant.id)
                          }
                          className="flex items-center gap-1 whitespace-nowrap text-left"
                        >
                          {hasProjects ? (
                            expanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0" />
                            )
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <span className="font-medium text-text-primary">
                            {row.consultant.name}
                            {row.consultant.teamName && (
                              <span className="ml-2 text-text-primary opacity-60">
                                ({row.consultant.teamName})
                              </span>
                            )}
                            {row.consultant.isExternal && (
                              <span className="ml-1.5 shrink-0 rounded-sm bg-brand-blue/60 px-1 py-0.5 text-[10px] text-text-primary">
                                External
                              </span>
                            )}
                          </span>
                        </button>
                      </td>
                      {row.percentByWeek.map((pct, i) => {
                        const details = row.percentDetailsByWeek?.[i];
                        const isOverallocated = pct > 115;
                        const title =
                          details && pct > 0
                            ? `${details.total}h of ${details.available}h (${pct}%)`
                            : undefined;
                        const hasBooking = pct > 0;
                        const prevHasBooking = i > 0 && (row.percentByWeek[i - 1] ?? 0) > 0;
                        const showLeftBorder = hasBooking && (i === 0 || !prevHasBooking);
                        const w = data.weeks[i];
                        const isDragRange =
                          cellDragConsultant?.id === row.consultant.id &&
                          cellDragWeekStart !== null &&
                          cellDragWeekEnd !== null &&
                          i >= Math.min(cellDragWeekStart, cellDragWeekEnd) &&
                          i <= Math.max(cellDragWeekStart, cellDragWeekEnd);
                        return (
                          <td
                            key={i}
                            className={`${showLeftBorder ? "border-l border-grid-light-subtle " : ""}${hasBooking ? "border-r border-grid-light-subtle" : ""} px-1 py-1 text-center select-none cursor-crosshair ${getAllocationCellBgClass(pct)} ${isCurrentWeek(w) ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} hover:bg-brand-blue/50 ${isDragRange ? "bg-brand-lilac/40 ring-1 ring-inset ring-brand-signal/50" : ""}`}
                            title={title}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setCellDragConsultant({
                                id: row.consultant.id,
                                name: row.consultant.name,
                              });
                              setCellDragWeekStart(i);
                              setCellDragWeekEnd(i);
                            }}
                            onMouseEnter={() => {
                              if (cellDragConsultant?.id === row.consultant.id)
                                setCellDragWeekEnd(i);
                            }}
                          >
                            {hasBooking ? (
                              <span
                                className={
                                  isOverallocated
                                    ? "font-medium text-danger"
                                    : undefined
                                }
                              >
                                {pct}%
                              </span>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                    {expanded &&
                      row.projectRows.map((pr) => (
                        <tr
                          key={pr.projectId}
                          className="border-b border-grid-light-subtle last:border-border"
                          style={{
                            backgroundColor: `${pr.customerColor}18`,
                          }}
                        >
                          <td className="border-r border-grid-light-subtle px-2 py-1 pl-8 text-[10px] text-text-primary">
                            <span className="whitespace-nowrap">
                              {pr.projectName} ({pr.customerName})
                              {(pr.roleName || row.consultant.defaultRoleName) && (
                                <span className="ml-2 text-text-primary opacity-70">
                                  · {pr.roleName || row.consultant.defaultRoleName}
                                </span>
                              )}
                            </span>
                          </td>
                          {pr.weeks.map((w, i) => {
                            const hasBooking = w.cell && w.cell.hours > 0;
                            const prevHasBooking = i > 0 && !!(pr.weeks[i - 1].cell && pr.weeks[i - 1].cell!.hours > 0);
                            const showLeftBorder = hasBooking && (i === 0 || !prevHasBooking);
                            const roleId =
                              w.cell?.roleId ??
                              pr.weeks.find((wk) => wk.cell?.roleId)?.cell
                                ?.roleId ??
                              null;
                            const isEditingConsultant =
                              editingCellConsultant?.consultantId ===
                                row.consultant.id &&
                              editingCellConsultant?.projectId === pr.projectId &&
                              editingCellConsultant?.weekIndex === i;
                            return (
                            <td
                              key={i}
                              className={`${showLeftBorder ? "border-l border-grid-light-subtle " : ""}${hasBooking ? "border-r border-grid-light-subtle" : ""} px-1 py-1 text-center select-none cursor-pointer ${isCurrentWeek(data.weeks[i]) ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} hover:bg-bg-muted/50 ${isEditingConsultant ? "p-0 align-middle" : ""}`}
                              onClick={(e) => {
                                if (
                                  (e.target as HTMLElement).closest("input")
                                )
                                  return;
                                setEditingCellConsultant({
                                  consultantId: row.consultant.id,
                                  projectId: pr.projectId,
                                  roleId,
                                  weekIndex: i,
                                  week: w.week,
                                  year: data.year,
                                  allocationId: w.cell?.id ?? null,
                                  currentHours: w.cell?.hours ?? 0,
                                });
                                setEditingCellConsultantValue(
                                  String(w.cell?.hours ?? "")
                                );
                              }}
                            >
                              {isEditingConsultant ? (
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={editingCellConsultantValue}
                                  onChange={(e) =>
                                    setEditingCellConsultantValue(
                                      e.target.value
                                    )
                                  }
                                  onFocus={(e) => e.target.select()}
                                  onBlur={handleCellConsultantInputBlur}
                                  onKeyDown={
                                    handleCellConsultantInputKeyDown
                                  }
                                  disabled={savingCellConsultant}
                                  className="w-full min-w-0 max-w-[3rem] rounded border border-brand-signal bg-bg-default px-1 py-0.5 text-center text-[10px] text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-signal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                />
                              ) : hasBooking ? (
                                <span>{w.cell!.hours}h</span>
                              ) : null}
                            </td>
                          );
                          })}
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
                  </tbody>
                </table>
              </div>
              <div className="p-2">
                <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-text-primary opacity-60">
                  External
                </h3>
                <table className="w-full min-w-0 table-fixed border border-border text-[10px]">
                  <colgroup>
                    <col className="w-[300px]" />
                    {data.weeks.map((w) => (
                      <col key={`ext-${w.year}-${w.week}`} className="w-[1.75rem]" />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-grid-subtle bg-bg-muted/80">
                      <th
                        rowSpan={2}
                        className="border-r border-grid-subtle px-2 py-1 text-left text-[10px] font-medium text-text-primary opacity-80"
                      >
                        Consultant / Project
                      </th>
                      {monthSpans.map((span, i) => (
                        <th
                          key={i}
                          colSpan={span.colSpan}
                          className="border-r border-grid-subtle px-0.5 py-1 text-center text-[10px] font-medium uppercase tracking-wide text-text-primary opacity-60"
                        >
                          {span.label}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b border-grid-subtle bg-bg-muted">
                      {renderWeekHeaderCells("external")}
                    </tr>
                  </thead>
                  <tbody>
                    {perConsultantExternal.map((row) => {
                const expanded = expandedConsultants.has(row.consultant.id);
                const hasProjects = row.projectRows.length > 0;
                return (
                  <Fragment key={row.consultant.id}>
                    <tr
                      className={`border-b border-grid-light-subtle last:border-border ${expanded && hasProjects ? "shadow-[0_2px_8px_rgba(0,0,0,0.28)]" : ""}`}
                    >
                      <td className="border-r border-grid-light-subtle px-2 py-1.5 align-top">
                        <button
                          type="button"
                          onClick={() =>
                            hasProjects && toggleConsultant(row.consultant.id)
                          }
                          className="flex items-center gap-1 whitespace-nowrap text-left"
                        >
                          {hasProjects ? (
                            expanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0" />
                            )
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <span className="font-medium text-text-primary">
                            {row.consultant.name}
                            {row.consultant.teamName && (
                              <span className="ml-2 text-text-primary opacity-60">
                                ({row.consultant.teamName})
                              </span>
                            )}
                            <span className="ml-1.5 shrink-0 rounded-sm bg-brand-blue/60 px-1 py-0.5 text-[10px] text-text-primary">
                              External
                            </span>
                          </span>
                          {expanded && hasProjects && (
                            <span
                              className={`shrink-0 ${
                                Math.max(
                                  ...row.percentByWeek.filter((p) => p > 0),
                                  0
                                ) > 115
                                  ? "font-medium text-danger"
                                  : "text-text-primary opacity-60"
                              }`}
                            >
                              (
                              {Math.max(
                                ...row.percentByWeek.filter((p) => p > 0),
                                0
                              )}
                              %)
                            </span>
                          )}
                        </button>
                      </td>
                      {row.percentByWeek.map((pct, i) => {
                        const details = row.percentDetailsByWeek?.[i];
                        const isOverallocated = pct > 115;
                        const title =
                          details && pct > 0
                            ? `${details.total}h of ${details.available}h (${pct}%)`
                            : undefined;
                        const hasBooking = pct > 0;
                        const prevHasBooking = i > 0 && (row.percentByWeek[i - 1] ?? 0) > 0;
                        const showLeftBorder = hasBooking && (i === 0 || !prevHasBooking);
                        const w = data.weeks[i];
                        const isDragRange =
                          cellDragConsultant?.id === row.consultant.id &&
                          cellDragWeekStart !== null &&
                          cellDragWeekEnd !== null &&
                          i >= Math.min(cellDragWeekStart, cellDragWeekEnd) &&
                          i <= Math.max(cellDragWeekStart, cellDragWeekEnd);
                        return (
                          <td
                            key={i}
                            className={`${showLeftBorder ? "border-l border-grid-light-subtle " : ""}${hasBooking ? "border-r border-grid-light-subtle" : ""} px-1 py-1 text-center select-none cursor-crosshair ${getAllocationCellBgClass(pct)} ${isCurrentWeek(w) ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} hover:bg-brand-blue/50 ${isDragRange ? "bg-brand-lilac/40 ring-1 ring-inset ring-brand-signal/50" : ""}`}
                            title={title}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setCellDragConsultant({
                                id: row.consultant.id,
                                name: row.consultant.name,
                              });
                              setCellDragWeekStart(i);
                              setCellDragWeekEnd(i);
                            }}
                            onMouseEnter={() => {
                              if (cellDragConsultant?.id === row.consultant.id)
                                setCellDragWeekEnd(i);
                            }}
                          >
                            {hasBooking ? (
                              <span
                                className={
                                  isOverallocated
                                    ? "font-medium text-danger"
                                    : undefined
                                }
                              >
                                {pct}%
                              </span>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                    {expanded &&
                      row.projectRows.map((pr) => (
                        <tr
                          key={pr.projectId}
                          className="border-b border-grid-light-subtle last:border-border"
                          style={{
                            backgroundColor: `${pr.customerColor}18`,
                          }}
                        >
                          <td className="border-r border-grid-light-subtle px-2 py-1 pl-8 text-[10px] text-text-primary">
                            <span className="whitespace-nowrap">
                              {pr.projectName} ({pr.customerName})
                              {(pr.roleName || row.consultant.defaultRoleName) && (
                                <span className="ml-2 text-text-primary opacity-70">
                                  · {pr.roleName || row.consultant.defaultRoleName}
                                </span>
                              )}
                            </span>
                          </td>
                          {pr.weeks.map((w, i) => {
                            const hasBooking = w.cell && w.cell.hours > 0;
                            const prevHasBooking = i > 0 && !!(pr.weeks[i - 1].cell && pr.weeks[i - 1].cell!.hours > 0);
                            const showLeftBorder = hasBooking && (i === 0 || !prevHasBooking);
                            const roleId =
                              w.cell?.roleId ??
                              pr.weeks.find((wk) => wk.cell?.roleId)?.cell
                                ?.roleId ??
                              null;
                            const isEditingConsultant =
                              editingCellConsultant?.consultantId ===
                                row.consultant.id &&
                              editingCellConsultant?.projectId === pr.projectId &&
                              editingCellConsultant?.weekIndex === i;
                            return (
                            <td
                              key={i}
                              className={`${showLeftBorder ? "border-l border-grid-light-subtle " : ""}${hasBooking ? "border-r border-grid-light-subtle" : ""} px-1 py-1 text-center select-none cursor-pointer ${isCurrentWeek(data.weeks[i]) ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} hover:bg-bg-muted/50 ${isEditingConsultant ? "p-0 align-middle" : ""}`}
                              onClick={(e) => {
                                if (
                                  (e.target as HTMLElement).closest("input")
                                )
                                  return;
                                setEditingCellConsultant({
                                  consultantId: row.consultant.id,
                                  projectId: pr.projectId,
                                  roleId,
                                  weekIndex: i,
                                  week: w.week,
                                  year: data.year,
                                  allocationId: w.cell?.id ?? null,
                                  currentHours: w.cell?.hours ?? 0,
                                });
                                setEditingCellConsultantValue(
                                  String(w.cell?.hours ?? "")
                                );
                              }}
                            >
                              {isEditingConsultant ? (
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={editingCellConsultantValue}
                                  onChange={(e) =>
                                    setEditingCellConsultantValue(
                                      e.target.value
                                    )
                                  }
                                  onFocus={(e) => e.target.select()}
                                  onBlur={handleCellConsultantInputBlur}
                                  onKeyDown={
                                    handleCellConsultantInputKeyDown
                                  }
                                  disabled={savingCellConsultant}
                                  className="w-full min-w-0 max-w-[3rem] rounded border border-brand-signal bg-bg-default px-1 py-0.5 text-center text-[10px] text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-signal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                />
                              ) : hasBooking ? (
                                <span>{w.cell!.hours}h</span>
                              ) : null}
                            </td>
                          );
                          })}
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {activeTab === "customer" && (
            <div className="p-2">
              <div className="mb-2 flex items-center justify-end gap-2 px-1">
                <span className="text-[10px] tabular-nums text-text-primary opacity-70">
                  {weekFrom <= weekTo
                        ? `${year} · v${weekFrom}–v${weekTo}`
                        : `${year} v${weekFrom} – ${year + 1} v${weekTo}`}
                </span>
                <button
                  type="button"
                  onClick={goToPreviousWeeks}
                  onMouseEnter={() => router.prefetch(getPreviousUrl())}
                  className="rounded-sm p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100"
                  aria-label="Previous weeks"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={goToNextWeeks}
                  onMouseEnter={() => router.prefetch(getNextUrl())}
                  className="rounded-sm p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100"
                  aria-label="Next weeks"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <table className="w-full min-w-0 table-fixed border border-border text-[10px]">
              <colgroup>
                <col className="w-[300px]" />
                {data.weeks.map((w) => (
                  <col key={`${w.year}-${w.week}`} className="w-[1.75rem]" />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-grid">
                  <th
                    rowSpan={2}
                    className="border-r border-grid px-2 py-1 text-left text-[10px] font-medium text-text-primary opacity-80"
                  >
                    Customer / Consultant
                  </th>
                  {monthSpans.map((span, i) => (
                    <th
                      key={i}
                      colSpan={span.colSpan}
                      className="border-r border-grid px-0.5 py-1 text-center text-[10px] font-medium uppercase tracking-wide text-text-primary opacity-60"
                    >
                      {span.label}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-grid">
                  {renderWeekHeaderCells("customer", "border-grid")}
                </tr>
              </thead>
              <tbody>
                {perCustomer.map((row) => {
                const expanded = expandedCustomers.has(row.customer.id);
                const hasConsultants = row.consultantRows.length > 0;
                return (
                  <Fragment key={row.customer.id}>
                    <tr className="border-b border-grid-light last:border-border bg-bg-muted/60">
                      <td className="border-r border-grid-light px-2 py-1 align-top">
                        <button
                          type="button"
                          onClick={() =>
                            hasConsultants &&
                            toggleCustomer(row.customer.id)
                          }
                          className="flex items-center gap-1 whitespace-nowrap text-left"
                        >
                          {hasConsultants ? (
                            expanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0" />
                            )
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <span className="font-semibold text-text-primary">{row.customer.name}</span>
                        </button>
                      </td>
                      {data.weeks.map((w, i) => {
                        const total = row.totalByWeek.get(w.week) ?? 0;
                        const hasBooking = total > 0;
                        const prevTotal = i > 0 ? row.totalByWeek.get(data.weeks[i - 1].week) ?? 0 : 0;
                        const showLeftBorder = hasBooking && (i === 0 || prevTotal === 0);
                        return (
                          <td
                            key={w.week}
                            className={`${showLeftBorder ? "border-l border-grid-light " : ""}${hasBooking ? "border-r border-grid-light" : ""} px-1 py-1 text-center text-text-primary ${isCurrentWeek(data.weeks[i]) ? "current-week-cell border-l border-r bg-brand-signal/15" : ""}`}
                          >
                            {hasBooking ? `${total}h` : null}
                          </td>
                        );
                      })}
                    </tr>
                    {expanded &&
                      row.consultantRows.map((cr) => (
                          <tr
                            key={`${cr.consultantId}-${cr.roleId ?? "none"}`}
                            className="border-b border-grid-light last:border-border bg-bg-default"
                          >
                            <td className="border-r border-grid-light px-2 py-1 pl-8 text-[10px]">
                              <span className="whitespace-nowrap font-normal text-text-primary">
                                {cr.consultantName}
                                {cr.roleName ? (
                                  <span className="opacity-80"> · {cr.roleName}</span>
                                ) : null}
                              </span>
                            </td>
                            {cr.weeks.map((w, i) => {
                              const cells = w.cells;
                              const totalHours = cells.reduce(
                                (s, x) => s + x.hours,
                                0
                              );
                              const hasBooking = totalHours > 0;
                              const prevHours = i > 0 ? cr.weeks[i - 1].cells.reduce((s, x) => s + x.hours, 0) : 0;
                              const showLeftBorder = hasBooking && (i === 0 || prevHours === 0);
                              const weekInfo = data.weeks[i];
                              const firstProjectForCustomer = data.projects.find(
                                (p) => p.customer_id === row.customer.id
                              );
                              const isEditing =
                                editingCell?.customerId === row.customer.id &&
                                editingCell?.consultantId === cr.consultantId &&
                                editingCell?.roleId === cr.roleId &&
                                editingCell?.weekIndex === i;
                              return (
                                <td
                                  key={i}
                                  className={`${showLeftBorder ? "border-l border-grid-light " : ""}${hasBooking ? "border-r border-grid-light" : ""} px-1 py-1 text-center cursor-pointer ${isCurrentWeek(weekInfo) ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} hover:bg-bg-muted/50 ${isEditing ? "p-0 align-middle" : ""}`}
                                  onClick={(e) => {
                                    if (
                                      (e.target as HTMLElement).closest("input")
                                    )
                                      return;
                                    setEditingCell({
                                      customerId: row.customer.id,
                                      consultantId: cr.consultantId,
                                      roleId: cr.roleId,
                                      weekIndex: i,
                                      week: w.week,
                                      year: data.year,
                                      allocationId: cells[0]?.id ?? null,
                                      otherAllocationIds: cells
                                        .slice(1)
                                        .map((c) => c.id),
                                      projectId:
                                        cells[0]?.projectId ??
                                        firstProjectForCustomer?.id ??
                                        "",
                                      currentHours: totalHours,
                                    });
                                    setEditingCellValue(
                                      String(totalHours || "")
                                    );
                                  }}
                                >
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={editingCellValue}
                                      onChange={(e) =>
                                        setEditingCellValue(e.target.value)
                                      }
                                      onFocus={(e) => e.target.select()}
                                      onBlur={handleCellInputBlur}
                                      onKeyDown={handleCellInputKeyDown}
                                      disabled={savingCell}
                                      className="w-full min-w-0 max-w-[3rem] rounded border border-brand-signal bg-bg-default px-1 py-0.5 text-center text-[10px] text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-signal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                    />
                                  ) : hasBooking ? (
                                    <span className="text-[10px] text-text-primary">
                                      {totalHours}h
                                    </span>
                                  ) : null}
                                </td>
                              );
                            })}
                          </tr>
                      ))}
                  </Fragment>
                );
              })}
              </tbody>
            </table>
            </div>
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
      />

      <EditAllocationModal
        allocation={editingAllocation}
        isOpen={editingAllocation !== null}
        onClose={() => setEditingAllocation(null)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
