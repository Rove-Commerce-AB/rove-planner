"use client";

import { useState, Fragment, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, ChevronLeft, Trash2, Percent, ExternalLink } from "lucide-react";
import {
  getMonthSpansForWeeks,
  addWeeksToYearWeek,
} from "@/lib/dateUtils";
import type { AllocationPageData } from "@/lib/allocationPage";
import { TO_PLAN_CONSULTANT_ID } from "@/lib/allocationPage";
import { DEFAULT_CUSTOMER_COLOR } from "@/lib/constants";
import { Select, Tabs, TabsList, TabsTrigger, PageHeader, Dialog, Button } from "@/components/ui";
import {
  createAllocation,
  updateAllocation,
} from "@/lib/allocations";
import {
  revalidateAllocationPage,
  getAllocationHistory,
  logAllocationHistoryCreate,
  logAllocationHistoryUpdate,
  deleteAllocationWithHistory,
  deleteAllocationsWithHistory,
  getBookingAllocationsForRow,
} from "@/app/(app)/allocation/actions";
import type { AllocationHistoryEntry } from "@/types";
import { AllocationHistoryTable } from "@/components/AllocationHistoryTable";

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

export type ProbabilityDisplay = "weighted" | "none";
export type ProjectVisibility = "all" | "hideNon100" | "hide100";

function getProjectProbabilityMap(projects: AllocationPageData["projects"]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of projects) {
    m.set(p.id, p.probability != null ? p.probability : 100);
  }
  return m;
}

function getDisplayHours(
  hours: number,
  projectId: string,
  display: ProbabilityDisplay,
  visibility: ProjectVisibility,
  probMap: Map<string, number>
): { displayHours: number; isHidden: boolean } {
  const prob = probMap.get(projectId) ?? 100;
  if (visibility === "hideNon100" && prob !== 100)
    return { displayHours: 0, isHidden: true };
  if (visibility === "hide100" && prob === 100)
    return { displayHours: 0, isHidden: true };
  if (display === "weighted")
    return { displayHours: Math.round(hours * (prob / 100)), isHidden: false };
  return { displayHours: hours, isHidden: false };
}

function showProbabilitySymbol(
  projectId: string,
  _display: ProbabilityDisplay,
  _visibility: ProjectVisibility,
  probMap: Map<string, number>
): boolean {
  const prob = probMap.get(projectId) ?? 100;
  return prob !== 100;
}

type ConsultantViewCell = {
  id: string;
  hours: number;
  displayHours: number;
  isHidden: boolean;
  roleName: string;
  roleId: string | null;
};

function buildPerConsultantView(
  data: AllocationPageData,
  probabilityDisplay: ProbabilityDisplay,
  projectVisibility: ProjectVisibility,
  projectProbabilityMap: Map<string, number>,
  getOptimisticDisplayHours?: (
    consultantId: string,
    projectId: string,
    roleId: string | null,
    year: number,
    week: number
  ) => number | undefined
) {
  const roleMap = new Map(data.roles.map((r) => [r.id, r.name]));
  const projectMap = new Map(
    data.projects.map((p) => [
      p.id,
      { name: p.name, customerName: p.customerName, customerColor: p.customerColor, customer_id: p.customer_id },
    ])
  );

  const weekKey = (y: number, w: number) => `${y}-${w}`;
  const byConsultant = new Map<
    string,
    Map<string, Map<string, { id: string; hours: number; roleName: string; roleId: string | null }>>
  >();

  for (const a of data.allocations) {
    const consultantKey = a.consultant_id ?? TO_PLAN_CONSULTANT_ID;
    const projectRowKey =
      consultantKey === TO_PLAN_CONSULTANT_ID
        ? `${a.project_id}\0${a.role_id ?? ""}`
        : a.project_id;

    if (!byConsultant.has(consultantKey)) {
      byConsultant.set(consultantKey, new Map());
    }
    const byProject = byConsultant.get(consultantKey)!;
    if (!byProject.has(projectRowKey)) {
      byProject.set(projectRowKey, new Map());
    }
    const byWeek = byProject.get(projectRowKey)!;
    byWeek.set(weekKey(a.year, a.week), {
      id: a.id,
      hours: a.hours,
      roleName: a.role_id ? roleMap.get(a.role_id) ?? "Unknown" : "",
      roleId: a.role_id,
    });
  }

  const sortedConsultants = [...data.consultants].sort((a, b) => {
    if (a.id === TO_PLAN_CONSULTANT_ID) return -1;
    if (b.id === TO_PLAN_CONSULTANT_ID) return 1;
    return a.name.localeCompare(b.name);
  });

  return sortedConsultants.map((c) => {
    const projectsMap = byConsultant.get(c.id);
    const projectRows: {
      projectId: string;
      projectName: string;
      customerId: string;
      customerName: string;
      customerColor: string;
      roleName: string;
      showProbabilitySymbol: boolean;
      weeks: { week: number; cell: ConsultantViewCell | null }[];
    }[] = [];

    if (projectsMap) {
      const rows: (typeof projectRows)[number][] = [];
      for (const [projectRowKey, byWeek] of projectsMap) {
        const projectId =
          c.id === TO_PLAN_CONSULTANT_ID
            ? projectRowKey.split("\0")[0] ?? projectRowKey
            : projectRowKey;
        const proj = projectMap.get(projectId);
        const weeks = data.weeks.map((w) => {
          const raw = byWeek.get(weekKey(w.year, w.week)) ?? null;
          if (!raw) return { week: w.week, cell: null };
          const { displayHours, isHidden } = getDisplayHours(
              raw.hours,
              projectId,
              probabilityDisplay,
              projectVisibility,
              projectProbabilityMap
            );
          return {
            week: w.week,
            cell: {
              id: raw.id,
              hours: raw.hours,
              displayHours,
              isHidden,
              roleName: raw.roleName,
              roleId: raw.roleId,
            },
          };
        });
        const firstCellWithRole = weeks.find((w) => w.cell?.roleName);
        const roleName = firstCellWithRole?.cell?.roleName ?? "";
        rows.push({
          projectId,
          projectName: proj?.name ?? "Unknown",
          customerId: proj?.customer_id ?? "",
          customerName: proj?.customerName ?? "",
          customerColor: proj?.customerColor ?? DEFAULT_CUSTOMER_COLOR,
          roleName,
          showProbabilitySymbol: showProbabilitySymbol(projectId, probabilityDisplay, projectVisibility, projectProbabilityMap),
          weeks,
        });
      }
      const rowsWithAllocations = rows.filter((pr) =>
        pr.weeks.some((w) => w.cell != null && w.cell.hours > 0)
      );
      rowsWithAllocations.sort((a, b) => a.projectName.localeCompare(b.projectName));
      projectRows.push(...rowsWithAllocations);
    }

    const totalByWeek = new Map<string, number>();
    for (const pr of projectRows) {
      pr.weeks.forEach((weekItem, j) => {
        const w = data.weeks[j];
        if (!w) return;
        const cell = weekItem.cell;
        const roleId =
          cell?.roleId ??
          pr.weeks.find((x) => x.cell?.roleId)?.cell?.roleId ??
          null;
        const optDisplay = getOptimisticDisplayHours?.(
          c.id,
          pr.projectId,
          roleId,
          w.year,
          weekItem.week
        );
        const toAdd =
          optDisplay !== undefined
            ? optDisplay
            : cell && !cell.isHidden
              ? cell.displayHours
              : 0;
        if (toAdd > 0) {
          const key = weekKey(w.year, w.week);
          totalByWeek.set(key, (totalByWeek.get(key) ?? 0) + toAdd);
        }
      });
    }

    const percentByWeek = data.weeks.map((w, i) => {
      const total = totalByWeek.get(weekKey(w.year, w.week)) ?? 0;
      const available = c.availableHoursByWeek[i] ?? c.hoursPerWeek;
      return available > 0 ? Math.round((total / available) * 100) : 0;
    });

    const percentDetailsByWeek = data.weeks.map((w, i) => {
      const total = totalByWeek.get(weekKey(w.year, w.week)) ?? 0;
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

type CustomerViewCellItem = {
  id: string;
  projectId: string;
  hours: number;
  displayHours: number;
  isHidden: boolean;
  roleName: string;
  roleId: string | null;
  projectName: string;
};

function buildPerCustomerView(
  data: AllocationPageData,
  probabilityDisplay: ProbabilityDisplay,
  projectVisibility: ProjectVisibility,
  projectProbabilityMap: Map<string, number>
) {
  const roleMap = new Map(data.roles.map((r) => [r.id, r.name]));
  const projectMap = new Map(
    data.projects.map((p) => [p.id, { customer_id: p.customer_id, customerName: p.customerName, name: p.name }])
  );

  const ROW_KEY_SEP = "|";
  const keyFor = (consultantId: string, roleId: string | null) =>
    `${consultantId}${ROW_KEY_SEP}${roleId ?? "__none__"}`;
  const weekKey = (y: number, w: number) => `${y}-${w}`;

  const byCustomer = new Map<
    string,
    Map<string, Map<string, { id: string; projectId: string; hours: number; roleName: string; roleId: string | null; projectName: string }[]>>
  >();

  for (const a of data.allocations) {
    const proj = projectMap.get(a.project_id);
    if (!proj) continue;
    const customerId = proj.customer_id;
    const projectName = projectMap.get(a.project_id)?.name ?? "Unknown";
    const roleId = a.role_id ?? null;
    const roleName = roleId ? roleMap.get(roleId) ?? "Unknown" : "";
    const rowKey = keyFor(a.consultant_id ?? TO_PLAN_CONSULTANT_ID, roleId);

    if (!byCustomer.has(customerId)) {
      byCustomer.set(customerId, new Map());
    }
    const byConsultantRole = byCustomer.get(customerId)!;
    if (!byConsultantRole.has(rowKey)) {
      byConsultantRole.set(rowKey, new Map());
    }
    const byWeek = byConsultantRole.get(rowKey)!;
    const yw = weekKey(a.year, a.week);
    if (!byWeek.has(yw)) {
      byWeek.set(yw, []);
    }
    byWeek.get(yw)!.push({
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
      unavailableByWeek: boolean[];
      weeks: { week: number; cells: CustomerViewCellItem[] }[];
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
        const weeks = data.weeks.map((w) => {
          const rawCells = byWeek?.get(weekKey(w.year, w.week)) ?? [];
          const cells: CustomerViewCellItem[] = rawCells.map((x) => {
            const { displayHours, isHidden } = getDisplayHours(
              x.hours,
              x.projectId,
              probabilityDisplay,
              projectVisibility,
              projectProbabilityMap
            );
            return {
              ...x,
              displayHours,
              isHidden,
            };
          });
          return { week: w.week, cells };
        });
        consultantRows.push({
          consultantId,
          consultantName: c?.name ?? "Unknown",
          roleId,
          roleName: roleId ? roleMap.get(roleId) ?? "Unknown" : "",
          unavailableByWeek: c?.unavailableByWeek ?? data.weeks.map(() => false),
          weeks,
        });
      }
    }

    const totalByWeek = new Map<string, number>();
    for (const cr of consultantRows) {
      cr.weeks.forEach(({ cells }, j) => {
        const w = data.weeks[j];
        const sum = cells.reduce((s, x) => s + (x.isHidden ? 0 : x.displayHours), 0);
        if (sum > 0 && w) {
          const key = weekKey(w.year, w.week);
          totalByWeek.set(key, (totalByWeek.get(key) ?? 0) + sum);
        }
      });
    }

    return {
      customer: cust,
      consultantRows,
      totalByWeek,
    };
  });
}

type ProjectViewCellItem = {
  id: string;
  projectId: string;
  hours: number;
  displayHours: number;
  isHidden: boolean;
  roleName: string;
  roleId: string | null;
  projectName: string;
};

function buildPerProjectView(
  data: AllocationPageData,
  probabilityDisplay: ProbabilityDisplay,
  projectVisibility: ProjectVisibility,
  projectProbabilityMap: Map<string, number>
) {
  const roleMap = new Map(data.roles.map((r) => [r.id, r.name]));
  const projectMap = new Map(
    data.projects.map((p) => [
      p.id,
      { customer_id: p.customer_id, customerName: p.customerName, name: p.name },
    ])
  );
  const ROW_KEY_SEP = "|";
  const keyFor = (consultantId: string, roleId: string | null) =>
    `${consultantId}${ROW_KEY_SEP}${roleId ?? "__none__"}`;
  const weekKey = (y: number, w: number) => `${y}-${w}`;

  const byProject = new Map<
    string,
    Map<string, Map<string, { id: string; projectId: string; hours: number; roleName: string; roleId: string | null; projectName: string }[]>>
  >();

  for (const a of data.allocations) {
    const proj = projectMap.get(a.project_id);
    if (!proj) continue;
    const projectName = proj.name;
    const roleId = a.role_id ?? null;
    const roleName = roleId ? roleMap.get(roleId) ?? "Unknown" : "";
    const rowKey = keyFor(a.consultant_id ?? TO_PLAN_CONSULTANT_ID, roleId);

    if (!byProject.has(a.project_id)) {
      byProject.set(a.project_id, new Map());
    }
    const byConsultantRole = byProject.get(a.project_id)!;
    if (!byConsultantRole.has(rowKey)) {
      byConsultantRole.set(rowKey, new Map());
    }
    const byWeek = byConsultantRole.get(rowKey)!;
    const yw = weekKey(a.year, a.week);
    if (!byWeek.has(yw)) {
      byWeek.set(yw, []);
    }
    byWeek.get(yw)!.push({
      id: a.id,
      projectId: a.project_id,
      hours: a.hours,
      roleName,
      roleId,
      projectName,
    });
  }

  const sortedProjects = [...data.projects]
    .filter(
      (p) => p.isActive !== false && p.customerIsActive !== false
    )
    .sort((a, b) => {
      const custCmp = a.customerName.localeCompare(b.customerName);
      if (custCmp !== 0) return custCmp;
      return a.name.localeCompare(b.name);
    });

  return sortedProjects.map((proj) => {
    const byConsultantRole = byProject.get(proj.id);
    const consultantRows: {
      consultantId: string;
      consultantName: string;
      roleId: string | null;
      roleName: string;
      unavailableByWeek: boolean[];
      weeks: { week: number; cells: ProjectViewCellItem[] }[];
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
        const weeks = data.weeks.map((w) => {
          const rawCells = byWeek?.get(weekKey(w.year, w.week)) ?? [];
          const cells: ProjectViewCellItem[] = rawCells.map((x) => {
            const { displayHours, isHidden } = getDisplayHours(
              x.hours,
              x.projectId,
              probabilityDisplay,
              projectVisibility,
              projectProbabilityMap
            );
            return {
              ...x,
              displayHours,
              isHidden,
            };
          });
          return { week: w.week, cells };
        });
        consultantRows.push({
          consultantId,
          consultantName: c?.name ?? "Unknown",
          roleId,
          roleName: roleId ? roleMap.get(roleId) ?? "Unknown" : "",
          unavailableByWeek: c?.unavailableByWeek ?? data.weeks.map(() => false),
          weeks,
        });
      }
    }

    const totalByWeek = new Map<string, number>();
    for (const cr of consultantRows) {
      cr.weeks.forEach(({ cells }, j) => {
        const w = data.weeks[j];
        const sum = cells.reduce((s, x) => s + (x.isHidden ? 0 : x.displayHours), 0);
        if (sum > 0 && w) {
          const key = weekKey(w.year, w.week);
          totalByWeek.set(key, (totalByWeek.get(key) ?? 0) + sum);
        }
      });
    }

    return {
      project: {
        id: proj.id,
        customer_id: proj.customer_id,
        customerName: proj.customerName,
        name: proj.name,
        label: `${proj.customerName} - ${proj.name}`,
        showProbabilitySymbol: showProbabilitySymbol(proj.id, probabilityDisplay, projectVisibility, projectProbabilityMap),
      },
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
  if (pct < 50) return "bg-danger/18";
  if (pct < 75) return "bg-danger/10";
  if (pct < 95) return "bg-success/10";
  if (pct <= 105) return "bg-success/20";
  if (pct <= 120) return "bg-brand-blue/14";
  return "bg-brand-blue/25";
}

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

  function allocationCellKey(
    consultantId: string,
    projectId: string,
    roleId: string | null,
    year: number,
    week: number
  ): string {
    return `${consultantId}|${projectId}|${roleId ?? ""}|${year}|${week}`;
  }

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

  const filteredData: AllocationPageData | null =
    data === null
      ? null
      : {
          consultants: data.consultants.filter((c) => {
            if (teamFilterId !== null && c.teamId !== teamFilterId)
              return false;
            if (defaultRoleFilterId !== null && c.defaultRoleId !== defaultRoleFilterId)
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

  const handleSuccess = async () => {
    await revalidateAllocationPage();
    router.refresh();
  };

  const saveCellHours = useCallback(
    async (cell: NonNullable<typeof editingCell>, value: string) => {
      const hours = parseFloat(value.replace(",", "."));
      if (isNaN(hours) || hours < 0) return;
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

  const toUrl = (first: { year: number; week: number }, last: { year: number; week: number }) => {
    const q = `year=${first.year}&from=${first.week}&to=${last.week}`;
    if (embedMode) {
      return `/projects/${embedMode.projectId}?${q}`;
    }
    return `/allocation?${q}`;
  };

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

  const getPreviousRange = (): { year: number; weekFrom: number; weekTo: number } => {
    const { first, last } = getFirstLastWeek();
    const newFirst = addWeeksToYearWeek(first.year, first.week, -SHIFT_WEEKS);
    const newLast = addWeeksToYearWeek(last.year, last.week, -SHIFT_WEEKS);
    return { year: newFirst.year, weekFrom: newFirst.week, weekTo: newLast.week };
  };

  const getNextRange = (): { year: number; weekFrom: number; weekTo: number } => {
    const { first, last } = getFirstLastWeek();
    const newFirst = addWeeksToYearWeek(first.year, first.week, SHIFT_WEEKS);
    const newLast = addWeeksToYearWeek(last.year, last.week, SHIFT_WEEKS);
    return { year: newFirst.year, weekFrom: newFirst.week, weekTo: newLast.week };
  };

  const goToPreviousWeeks = () => {
    if (onWeekRangeChange) {
      const { year: y, weekFrom: f, weekTo: t } = getPreviousRange();
      void onWeekRangeChange(y, f, t);
      return;
    }
    router.push(getPreviousUrl());
  };

  const goToNextWeeks = () => {
    if (onWeekRangeChange) {
      const { year: y, weekFrom: f, weekTo: t } = getNextRange();
      void onWeekRangeChange(y, f, t);
      return;
    }
    router.push(getNextUrl());
  };

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
    const isSingleCellClick = fromIdx === toIdx;
    if (isSingleCellClick && internalRows.length > 0) {
      const row = internalRows.find((r) => r.consultant.id === cellDragConsultant.id);
      if (row && row.projectRows.length > 0) {
        const pr = row.projectRows[0];
        const w = pr.weeks[fromIdx];
        const weekKey = data.weeks[fromIdx];
        if (weekKey) {
          const roleId =
            w?.cell?.roleId ??
            pr.weeks.find((wk) => wk.cell?.roleId)?.cell?.roleId ??
            null;
          setExpandedConsultants((prev) => new Set(prev).add(row.consultant.id));
          setEditingCellConsultant({
            consultantId: row.consultant.id,
            projectId: pr.projectId,
            roleId,
            weekIndex: fromIdx,
            week: weekKey.week,
            year: weekKey.year,
            allocationId: w?.cell?.id ?? null,
            currentHours: w?.cell?.hours ?? 0,
          });
          setEditingCellConsultantValue(String(w?.cell?.hours ?? 0));
          setCellDragConsultant(null);
          setCellDragWeekStart(null);
          setCellDragWeekEnd(null);
          return;
        }
      }
    }
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
  /** Revenue in thousands with apostrophe (e.g. 23200 → "23,2'") to fit in narrow cells. */
  const formatSek = (n: number) =>
    n > 0
      ? `${(n / 1000).toLocaleString("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}'`
      : "\u00A0";

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
        <div className="mb-4 flex w-full gap-2 border-b border-border px-1 py-2" aria-hidden="true">
          <span className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-primary opacity-70">
            Per consultant
          </span>
          <span className="ml-auto px-4 py-2 text-sm text-text-primary opacity-70">
            Allocation history
          </span>
        </div>
      ))}

      {data && !embedMode && (
        <div className="mb-3 flex flex-wrap items-center gap-3 px-2">
          <Select
            value={probabilityDisplay}
            onValueChange={(v) => setProbabilityDisplay(v as ProbabilityDisplay)}
            options={[
              { value: "weighted", label: "Show with probability" },
              { value: "none", label: "Show without probability" },
            ]}
            className="w-auto min-w-[200px]"
          />
          <Select
            value={projectVisibility}
            onValueChange={(v) => setProjectVisibility(v as ProjectVisibility)}
            options={[
              { value: "all", label: "Show all" },
              { value: "hideNon100", label: "Hide projects that are not 100%" },
              { value: "hide100", label: "Hide projects that are 100%" },
            ]}
            className="w-auto min-w-[200px]"
          />
          {data.teams.length > 0 && (
            <Select
              value={teamFilterId ?? ""}
              onValueChange={(v) => setTeamFilterId(v ? v : null)}
              options={[
                { value: "", label: "All teams" },
                ...data.teams.map((t) => ({ value: t.id, label: t.name })),
              ]}
              className="w-auto min-w-[120px]"
            />
          )}
          {activeTab !== "history" && data.roles.length > 0 && (
            <Select
              value={defaultRoleFilterId ?? ""}
              onValueChange={(v) => setDefaultRoleFilterId(v ? v : null)}
              options={[
                { value: "", label: "All default roles" },
                ...data.roles.map((r) => ({ value: r.id, label: r.name })),
              ]}
              className="w-auto min-w-[140px]"
            />
          )}
          {activeTab === "project" && (
            <label className="flex cursor-pointer select-none items-center gap-2">
              <input
                type="checkbox"
                checked={showProjectsWithoutBooking}
                onChange={(e) => setShowProjectsWithoutBooking(e.target.checked)}
                className="rounded border-border"
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
            <>
              <div className="p-2">
                {expandableConsultantIds.size > 0 && (
                  <div className="mb-1 flex items-center gap-2 px-1">
                    <button
                      type="button"
                      onClick={() => setExpandedConsultants(new Set(expandableConsultantIds))}
                      className="cursor-pointer text-xs text-text-primary opacity-70 hover:underline hover:opacity-100"
                    >
                      Expand all
                    </button>
                    <span className="text-xs text-text-primary opacity-50">|</span>
                    <button
                      type="button"
                      onClick={() => setExpandedConsultants(new Set())}
                      className="cursor-pointer text-xs text-text-primary opacity-70 hover:underline hover:opacity-100"
                    >
                      Collapse all
                    </button>
                  </div>
                )}
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  {embedMode ? (
                    <span className="shrink-0" />
                  ) : (
                  <h3 className="text-xs font-medium uppercase tracking-wider text-text-primary opacity-60">
                    Internal
                  </h3>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] tabular-nums text-text-primary opacity-70">
                      {weekFrom <= weekTo
                        ? `${year} · v${weekFrom}–v${weekTo}`
                        : `${year} v${weekFrom} – ${year + 1} v${weekTo}`}
                    </span>
                    <button
                      type="button"
                      onClick={goToPreviousWeeks}
                      disabled={embedWeekNavLoading}
                      onMouseEnter={() => !onWeekRangeChange && router.prefetch(getPreviousUrl())}
                      className="rounded-sm p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100 disabled:opacity-50 disabled:pointer-events-none"
                      aria-label="Previous weeks"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={goToNextWeeks}
                      disabled={embedWeekNavLoading}
                      onMouseEnter={() => !onWeekRangeChange && router.prefetch(getNextUrl())}
                      className="rounded-sm p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100 disabled:opacity-50 disabled:pointer-events-none"
                      aria-label="Next weeks"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <table className="w-full min-w-0 table-fixed border border-border text-[10px]">
                  <colgroup>
                    <col style={{ width: embedMode ? 72 : 300 }} />
                    {data.weeks.map((w) => (
                      <col
                        key={`${w.year}-${w.week}`}
                        className={embedMode ? "w-[10px]" : "w-[1.75rem]"}
                      />
                    ))}
                    {embedMode && <col className="w-5" />}
                    {embedMode && data.consultantTotalHours != null && <col className="w-5" />}
                    {!embedMode && <col className="w-6" />}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-grid-subtle bg-bg-muted/80">
                      <th
                        rowSpan={2}
                        style={{ width: embedMode ? 72 : 300, maxWidth: embedMode ? 72 : 300, boxSizing: 'border-box' }}
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
                      {embedMode && (
                        <th
                          rowSpan={2}
                          className="w-5 border-l border-r border-grid-subtle px-0.5 py-1 text-center text-[10px] font-medium text-text-primary opacity-80"
                        >
                          Tot view
                        </th>
                      )}
                      {embedMode && data.consultantTotalHours != null && (
                        <th
                          rowSpan={2}
                          className="w-5 border-r border-grid-subtle px-0.5 py-1 text-center text-[10px] font-medium text-text-primary opacity-80"
                        >
                          Tot
                          <br />
                          <span className="font-normal opacity-70">(Budget)</span>
                        </th>
                      )}
                      {!embedMode && (
                        <th
                          rowSpan={2}
                          className="w-6 border-r border-grid-subtle px-0 py-0.5 text-center"
                          aria-label="Remove booking"
                        />
                      )}
                    </tr>
                    <tr className="border-b border-grid-subtle bg-bg-muted">
                      {renderWeekHeaderCells("internal")}
                    </tr>
                  </thead>
                  <tbody>
                    {(embedMode ? perConsultantDisplay : perConsultantInternal).map((row) => {
                const expanded = expandedConsultants.has(row.consultant.id);
                const hasProjects = row.projectRows.length > 0;
                const isToPlan = row.consultant.id === TO_PLAN_CONSULTANT_ID;
                return (
                  <Fragment key={row.consultant.id}>
                    <tr
                      className={`border-b border-grid-light-subtle last:border-border ${isToPlan ? "bg-bg-muted/60" : ""} ${expanded && hasProjects ? "shadow-[0_2px_8px_rgba(0,0,0,0.28)]" : ""}`}
                    >
                      <td className={`border-r border-grid-light-subtle px-2 py-1.5 align-top ${embedMode ? "max-w-0" : ""}`}>
                        <div className={`flex items-center justify-between gap-1 w-full ${embedMode ? "min-w-0" : ""}`}>
                          <button
                            type="button"
                            onClick={() =>
                              hasProjects && toggleConsultant(row.consultant.id)
                            }
                            className={`flex min-w-0 flex-1 items-center gap-1 text-left ${embedMode ? "overflow-hidden" : "whitespace-nowrap"}`}
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
                            <span className={`font-medium text-text-primary ${embedMode ? "min-w-0 truncate" : ""}`} title={embedMode ? row.consultant.name : undefined}>
                              {row.consultant.name}
                              {!embedMode && row.consultant.teamName && (
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
                          {row.consultant.id !== TO_PLAN_CONSULTANT_ID && (
                            <Link
                              href={`/consultants/${row.consultant.id}`}
                              className="shrink-0 rounded p-0.5 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100"
                              aria-label={`Open ${row.consultant.name}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      </td>
                      {row.percentByWeek.map((pct, i) => {
                        const details = row.percentDetailsByWeek?.[i];
                        const totalHours = details?.total ?? 0;
                        const isOverallocated = !isToPlan && pct > 115;
                        const showHoursOnNameRow = embedMode || isToPlan;
                        const title =
                          showHoursOnNameRow && totalHours > 0
                            ? `${totalHours}`
                            : details && pct > 0
                              ? `${details.total} of ${details.available} (${pct}%)`
                              : undefined;
                        const hasBooking = isToPlan ? totalHours > 0 : (embedMode ? totalHours > 0 : pct > 0);
                        const prevHasBooking = i > 0 && (isToPlan ? (row.percentDetailsByWeek?.[i - 1]?.total ?? 0) > 0 : embedMode ? (row.percentDetailsByWeek?.[i - 1]?.total ?? 0) > 0 : (row.percentByWeek[i - 1] ?? 0) > 0);
                        const showLeftBorder = hasBooking && (i === 0 || !prevHasBooking);
                        const w = data.weeks[i];
                        const isDragRange =
                          cellDragConsultant?.id === row.consultant.id &&
                          cellDragWeekStart !== null &&
                          cellDragWeekEnd !== null &&
                          i >= Math.min(cellDragWeekStart, cellDragWeekEnd) &&
                          i <= Math.max(cellDragWeekStart, cellDragWeekEnd);
                        const dragMin = Math.min(cellDragWeekStart ?? 0, cellDragWeekEnd ?? 0);
                        const dragMax = Math.max(cellDragWeekStart ?? 0, cellDragWeekEnd ?? 0);
                        const isDragLeft = isDragRange && i === dragMin;
                        const isDragRight = isDragRange && i === dragMax;
                        return (
                          <td
                            key={`${w.year}-${w.week}`}
                            className={`${showLeftBorder ? "border-l border-grid-light-subtle " : ""}${hasBooking ? "border-r border-grid-light-subtle" : ""} px-1 py-1 text-center text-[10px] tabular-nums overflow-hidden select-none cursor-crosshair ${!isDragRange && row.consultant.unavailableByWeek[i] ? "!bg-[var(--color-border-default)] text-text-primary" : ""} ${!isDragRange && !row.consultant.unavailableByWeek[i] && !isToPlan ? (embedMode ? (pct > 0 ? "bg-success/20" : "") : getAllocationCellBgClass(pct)) : ""} ${isCurrentWeek(w) && !row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} ${isCurrentWeek(w) && row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r" : ""} ${!isDragRange ? "hover:!bg-brand-blue/50" : ""} ${isDragRange ? "drag-range-cell border-t border-b" : ""} ${isDragLeft ? "border-l" : ""} ${isDragRight ? "border-r" : ""}`}
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
                                {showHoursOnNameRow ? `${totalHours}` : `${pct}%`}
                              </span>
                            ) : null}
                          </td>
                        );
                      })}
                      {embedMode && (() => {
                        const rowTotal = (row.percentDetailsByWeek ?? []).reduce(
                          (s, d) => s + (d?.total ?? 0),
                          0
                        );
                        return (
                          <td className="border-l border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] tabular-nums text-text-primary [border-left-color:var(--color-grid-border-subtle)]">
                            {rowTotal > 0 ? `${rowTotal}` : "\u00A0"}
                          </td>
                        );
                      })()}
                      {embedMode && data.consultantTotalHours != null && (() => {
                        const allTimeTotal = data.consultantTotalHours[row.consultant.id] ?? 0;
                        return (
                          <td className="border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] tabular-nums text-text-primary font-medium">
                            {allTimeTotal > 0 ? `${allTimeTotal}` : "\u00A0"}
                          </td>
                        );
                      })()}
                      {!embedMode && <td className="border-r border-grid-light-subtle px-0 py-0.5 w-6" />}
                    </tr>
                    {expanded &&
                      row.projectRows.map((pr) => {
                        const allocationsWithBooking: DeleteBookingItem[] = [];
                        pr.weeks.forEach((w, i) => {
                          if (w.cell?.id && w.cell.hours > 0 && data.weeks[i]) {
                            allocationsWithBooking.push({
                              allocationId: w.cell.id,
                              year: data.weeks[i].year,
                              week: data.weeks[i].week,
                            });
                          }
                        });
                        const hasAnyBooking = allocationsWithBooking.length > 0;
                        return (
                        <tr
                          key={pr.projectId + (pr.roleName || "")}
                          className="border-b border-grid-light-subtle last:border-border"
                          style={{
                            backgroundColor: `${pr.customerColor}18`,
                          }}
                        >
                          <td className={`border-r border-grid-light-subtle px-2 py-1 pl-8 text-[10px] text-text-primary ${embedMode ? "max-w-0" : ""}`}>
                            <span className={`flex items-center gap-1 ${embedMode ? "min-w-0 overflow-hidden" : "whitespace-nowrap"}`}>
                              {!embedMode && pr.showProbabilitySymbol && (
                                <Percent
                                  className="h-3 w-3 shrink-0 opacity-60"
                                  aria-label="Sannolikhet under 100%"
                                />
                              )}
                              <span className={embedMode ? "min-w-0 truncate" : ""} title={embedMode ? (pr.roleName || row.consultant.defaultRoleName) || undefined : undefined}>
                                {embedMode ? (
                                  pr.roleName || row.consultant.defaultRoleName || "\u00A0"
                                ) : (
                                  <>
                                    {pr.customerId ? (
                                      <Link
                                        href={`/customers/${pr.customerId}`}
                                        className="cursor-pointer hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {pr.customerName}
                                      </Link>
                                    ) : (
                                      pr.customerName
                                    )}
                                    {" - "}
                                    <Link
                                      href={`/projects/${pr.projectId}`}
                                      className="cursor-pointer hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {pr.projectName}
                                    </Link>
                                    {(pr.roleName || row.consultant.defaultRoleName) && (
                                      <span className="ml-2 text-text-primary opacity-70">
                                        · {pr.roleName || row.consultant.defaultRoleName}
                                      </span>
                                    )}
                                  </>
                                )}
                              </span>
                            </span>
                          </td>
                          {pr.weeks.map((w, i) => {
                            const weekKey = data.weeks[i];
                            const roleId =
                              w.cell?.roleId ??
                              pr.weeks.find((wk) => wk.cell?.roleId)?.cell
                                ?.roleId ??
                              null;
                            const cellKey = allocationCellKey(
                              row.consultant.id,
                              pr.projectId,
                              roleId,
                              weekKey.year,
                              w.week
                            );
                            const optimisticHours = optimisticCellHours[cellKey];
                            const effectiveDisplayHours =
                              optimisticHours != null ? optimisticHours : w.cell?.displayHours;
                            const hasBooking = (effectiveDisplayHours ?? 0) > 0;
                            const prevWeek = i > 0 ? pr.weeks[i - 1] : null;
                            const prevCellKey =
                              prevWeek && data.weeks[i - 1]
                                ? allocationCellKey(
                                    row.consultant.id,
                                    pr.projectId,
                                    prevWeek.cell?.roleId ??
                                      pr.weeks.find((x) => x.cell?.roleId)?.cell
                                        ?.roleId ??
                                      null,
                                    data.weeks[i - 1].year,
                                    prevWeek.week
                                  )
                                : "";
                            const prevEffective =
                              prevCellKey && optimisticCellHours[prevCellKey] != null
                                ? optimisticCellHours[prevCellKey]
                                : prevWeek?.cell?.displayHours;
                            const prevHasBooking = (prevEffective ?? 0) > 0;
                            const displayText =
                              w.cell?.isHidden && optimisticHours == null
                                ? "—"
                                : effectiveDisplayHours != null &&
                                    effectiveDisplayHours > 0
                                  ? `${effectiveDisplayHours}`
                                  : null;
                            const showLeftBorder = hasBooking && (i === 0 || !prevHasBooking);
                            const isEditingConsultant =
                              editingCellConsultant?.consultantId ===
                                row.consultant.id &&
                              editingCellConsultant?.projectId === pr.projectId &&
                              editingCellConsultant?.weekIndex === i;
                            const effectiveHours =
                              optimisticHours != null ? optimisticHours : (w.cell?.hours ?? 0);
                            const openEditor = () => {
                              setEditingCellConsultant({
                                consultantId: row.consultant.id,
                                projectId: pr.projectId,
                                roleId,
                                weekIndex: i,
                                week: w.week,
                                year: weekKey.year,
                                allocationId: w.cell?.id ?? null,
                                currentHours: effectiveHours,
                              });
                              setEditingCellConsultantValue(
                                String(effectiveHours)
                              );
                            };
                            const isProjectDragRange =
                              projectRowDrag?.consultantId === row.consultant.id &&
                              projectRowDrag?.projectId === pr.projectId &&
                              i >= Math.min(projectRowDrag.weekIndexStart, projectRowDrag.weekIndexEnd) &&
                              i <= Math.max(projectRowDrag.weekIndexStart, projectRowDrag.weekIndexEnd);
                            return (
                            <td
                              key={`${weekKey.year}-${weekKey.week}`}
                              className={`${showLeftBorder ? "border-l border-grid-light-subtle " : ""}${hasBooking ? "border-r border-grid-light-subtle" : ""} p-0 py-1 text-center select-none cursor-pointer ${row.consultant.unavailableByWeek[i] ? "!bg-[var(--color-border-default)] text-text-primary" : ""} ${isCurrentWeek(data.weeks[i]) && !row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} ${isCurrentWeek(data.weeks[i]) && row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r" : ""} ${isEditingConsultant ? "align-middle" : ""} ${isProjectDragRange ? "drag-range-cell border-t border-b border-l border-r border-brand-signal bg-brand-signal/20" : ""}`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setProjectRowDrag({
                                  consultantId: row.consultant.id,
                                  projectId: pr.projectId,
                                  roleId,
                                  consultantName: row.consultant.name,
                                  projectLabel: `${pr.customerName} - ${pr.projectName}`,
                                  roleName: pr.roleName ?? row.consultant.defaultRoleName ?? undefined,
                                  weekIndexStart: i,
                                  weekIndexEnd: i,
                                });
                                setProjectRowDragMoved(false);
                              }}
                              onMouseEnter={() => {
                                if (projectRowDrag?.consultantId === row.consultant.id && projectRowDrag?.projectId === pr.projectId) {
                                  setProjectRowDrag((prev) => (prev ? { ...prev, weekIndexEnd: i } : null));
                                  setProjectRowDragMoved(true);
                                }
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
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (preventNextCellClickRef.current) {
                                      preventNextCellClickRef.current = false;
                                      return;
                                    }
                                    openEditor();
                                  }}
                                  className="block w-full min-h-[1.5rem] cursor-pointer border-0 bg-transparent px-1 py-0.5 text-center text-[10px] text-text-primary hover:bg-bg-muted/50 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand-signal"
                                  tabIndex={0}
                                >
                                  {displayText ?? "\u00A0"}
                                </button>
                              )}
                            </td>
                          );
                          })}
                          {embedMode && (() => {
                            const prRowTotal = pr.weeks.reduce((s, w, i) => {
                              const weekKey = data.weeks[i];
                              const roleId =
                                w.cell?.roleId ??
                                pr.weeks.find((x) => x.cell?.roleId)?.cell?.roleId ??
                                null;
                              const cellKey = weekKey
                                ? allocationCellKey(
                                    row.consultant.id,
                                    pr.projectId,
                                    roleId,
                                    weekKey.year,
                                    w.week
                                  )
                                : "";
                              const opt = optimisticCellHours[cellKey];
                              const hours =
                                opt != null ? opt : (w.cell?.displayHours ?? 0);
                              return s + hours;
                            }, 0);
                            return (
                              <td className="border-l border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] tabular-nums text-text-primary align-middle [border-left-color:var(--color-grid-border-subtle)]">
                                {prRowTotal > 0 ? `${prRowTotal}` : "\u00A0"}
                              </td>
                            );
                          })()}
                          {embedMode && data.consultantTotalHours != null && (
                            <td className="border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] text-text-primary align-middle">
                              {"\u00A0"}
                            </td>
                          )}
                          {!embedMode && (
                            <td className="border-r border-grid-light-subtle px-0 py-0.5 w-6 align-middle text-center">
                              {hasAnyBooking ? (
                                <button
                                  type="button"
                                  disabled={loadingDeleteBooking}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const roleId =
                                      pr.weeks.find((wk) => wk.cell?.roleId)?.cell?.roleId ?? null;
                                    setLoadingDeleteBooking(true);
                                    try {
                                      const list = await getBookingAllocationsForRow(
                                        row.consultant.id === TO_PLAN_CONSULTANT_ID ? null : row.consultant.id,
                                        pr.projectId,
                                        roleId
                                      );
                                      setDeleteBookingDialog({
                                        consultantId: row.consultant.id,
                                        consultantName: row.consultant.name,
                                        projectId: pr.projectId,
                                        projectLabel: `${pr.customerName} - ${pr.projectName}`,
                                        allocations: list.map((a) => ({
                                          allocationId: a.id,
                                          year: a.year,
                                          week: a.week,
                                        })),
                                        selectedAllocationIds: new Set(),
                                      });
                                    } catch (err) {
                                      alert(err instanceof Error ? err.message : "Failed to load booking");
                                    } finally {
                                      setLoadingDeleteBooking(false);
                                    }
                                  }}
                                  className="cursor-pointer inline-flex rounded p-0.5 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100 hover:text-danger focus:outline-none focus:ring-2 focus:ring-brand-signal disabled:opacity-50"
                                  aria-label="Remove booking"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </td>
                          )}
                        </tr>
                      );
                      })}
                  </Fragment>
                );
              })}
                  </tbody>
                  {embedMode && (
                  <tfoot>
                    <tr className="border-t-2 border-grid-subtle bg-bg-muted/60">
                      <td className="border-r border-grid-light-subtle px-2 py-1 text-[10px] font-medium text-text-primary">
                        Week total (h)
                      </td>
                      {data.weeks.map((w, i) => (
                        <td
                          key={`ft-h-${w.year}-${w.week}`}
                          className="border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] tabular-nums text-text-primary"
                        >
                          {weekTotalsHours[i] > 0 ? `${weekTotalsHours[i]}` : "\u00A0"}
                        </td>
                      ))}
                      <td className="border-l border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] tabular-nums text-text-primary [border-left-color:var(--color-grid-border-subtle)]">
                        {grandTotalHours > 0 ? `${grandTotalHours}` : "\u00A0"}
                      </td>
                      {data.consultantTotalHours != null && (
                        <td className="border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] font-medium tabular-nums text-text-primary">
                          {Object.values(data.consultantTotalHours).reduce((a, b) => a + b, 0) > 0
                            ? `${Object.values(data.consultantTotalHours).reduce((a, b) => a + b, 0)}`
                            : "\u00A0"}
                          {embedMode?.budgetHours != null && (
                            <>
                              <br />
                              <span className="opacity-70">({embedMode.budgetHours})</span>
                            </>
                          )}
                        </td>
                      )}
                      {!embedMode && <td className="w-6 border-r border-grid-light-subtle px-0 py-0.5" />}
                    </tr>
                    <tr className="border-t border-grid-subtle bg-bg-muted/40">
                      <td className="border-r border-grid-light-subtle px-2 py-1 text-[10px] font-medium text-text-primary">
                        Revenue total
                      </td>
                      {data.weeks.map((w, i) => (
                        <td
                          key={`ft-m-${w.year}-${w.week}`}
                          className="border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] tabular-nums text-text-primary"
                        >
                          {weekTotalsMoney != null
                            ? formatSek(weekTotalsMoney[i] ?? 0)
                            : "—"}
                        </td>
                      ))}
                      <td className="border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] tabular-nums text-text-primary">
                        {weekTotalsMoney != null
                          ? formatSek(grandTotalMoney)
                          : "—"}
                      </td>
                      {data.consultantTotalHours != null && (
                        <td className="border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] font-medium tabular-nums text-text-primary">
                          {weekTotalsMoney != null
                            ? formatSek(grandTotalMoney)
                            : "—"}
                          {embedMode?.budgetMoney != null && (
                            <>
                              <br />
                              <span className="opacity-70">({formatSek(embedMode.budgetMoney)})</span>
                            </>
                          )}
                        </td>
                      )}
                      {!embedMode && <td className="w-6 border-r border-grid-light-subtle px-0 py-0.5" />}
                    </tr>
                  </tfoot>
                  )}
                </table>
              </div>
              {!embedMode && (
              <div className="p-2">
                <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-text-primary opacity-60">
                  External
                </h3>
                <table className="w-full min-w-0 table-fixed border border-border text-[10px]">
                  <colgroup>
                    <col style={{ width: 300 }} />
                    {data.weeks.map((w) => (
                      <col key={`ext-${w.year}-${w.week}`} className="w-[1.75rem]" />
                    ))}
                    <col className="w-6" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-grid-subtle bg-bg-muted/80">
                      <th
                        rowSpan={2}
                        style={{ width: 300, maxWidth: 300, boxSizing: 'border-box' }}
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
                      <th
                        rowSpan={2}
                        className="w-6 border-r border-grid-subtle px-0 py-0.5 text-center"
                        aria-label="Remove booking"
                      />
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
                        <div className="flex items-center justify-between gap-1 w-full">
                          <button
                            type="button"
                            onClick={() =>
                              hasProjects && toggleConsultant(row.consultant.id)
                            }
                            className="flex min-w-0 flex-1 items-center gap-1 whitespace-nowrap text-left"
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
                          <Link
                            href={`/consultants/${row.consultant.id}`}
                            className="shrink-0 rounded p-0.5 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100"
                            aria-label={`Open ${row.consultant.name}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                      {row.percentByWeek.map((pct, i) => {
                        const details = row.percentDetailsByWeek?.[i];
                        const isOverallocated = pct > 115;
                        const title =
                          details && pct > 0
                            ? `${details.total} of ${details.available} (${pct}%)`
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
                        const dragMin = Math.min(cellDragWeekStart ?? 0, cellDragWeekEnd ?? 0);
                        const dragMax = Math.max(cellDragWeekStart ?? 0, cellDragWeekEnd ?? 0);
                        const isDragLeft = isDragRange && i === dragMin;
                        const isDragRight = isDragRange && i === dragMax;
                        return (
                          <td
                            key={`${w.year}-${w.week}`}
                            className={`${showLeftBorder ? "border-l border-grid-light-subtle " : ""}${hasBooking ? "border-r border-grid-light-subtle" : ""} px-1 py-1 text-center text-[10px] tabular-nums overflow-hidden select-none cursor-crosshair ${!isDragRange && row.consultant.unavailableByWeek[i] ? "!bg-[var(--color-border-default)] text-text-primary" : ""} ${!isDragRange && !row.consultant.unavailableByWeek[i] ? getAllocationCellBgClass(pct) : ""} ${isCurrentWeek(w) && !row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} ${isCurrentWeek(w) && row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r" : ""} ${!isDragRange ? "hover:!bg-brand-blue/50" : ""} ${isDragRange ? "drag-range-cell border-t border-b" : ""} ${isDragLeft ? "border-l" : ""} ${isDragRight ? "border-r" : ""}`}
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
                      <td className="border-r border-grid-light-subtle px-0 py-0.5 w-6" />
                    </tr>
                    {expanded &&
                      row.projectRows.map((pr) => {
                        const allocationsWithBooking: DeleteBookingItem[] = [];
                        pr.weeks.forEach((w, i) => {
                          if (w.cell?.id && w.cell.hours > 0 && data.weeks[i]) {
                            allocationsWithBooking.push({
                              allocationId: w.cell.id,
                              year: data.weeks[i].year,
                              week: data.weeks[i].week,
                            });
                          }
                        });
                        const hasAnyBooking = allocationsWithBooking.length > 0;
                        return (
                        <tr
                          key={pr.projectId}
                          className="border-b border-grid-light-subtle last:border-border"
                          style={{
                            backgroundColor: `${pr.customerColor}18`,
                          }}
                        >
                          <td className="border-r border-grid-light-subtle px-2 py-1 pl-8 text-[10px] text-text-primary">
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              {pr.showProbabilitySymbol && (
                                <Percent
                                  className="h-3 w-3 shrink-0 opacity-60"
                                  aria-label="Sannolikhet under 100%"
                                />
                              )}
                              {pr.customerId ? (
                                <Link
                                  href={`/customers/${pr.customerId}`}
                                  className="cursor-pointer hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {pr.customerName}
                                </Link>
                              ) : (
                                pr.customerName
                              )}
                              {" - "}
                              <Link
                                href={`/projects/${pr.projectId}`}
                                className="cursor-pointer hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {pr.projectName}
                              </Link>
                              {(pr.roleName || row.consultant.defaultRoleName) && (
                                <span className="ml-2 text-text-primary opacity-70">
                                  · {pr.roleName || row.consultant.defaultRoleName}
                                </span>
                              )}
                            </span>
                          </td>
                          {pr.weeks.map((w, i) => {
                            const weekKey = data.weeks[i];
                            const roleId =
                              w.cell?.roleId ??
                              pr.weeks.find((wk) => wk.cell?.roleId)?.cell
                                ?.roleId ??
                              null;
                            const cellKey = allocationCellKey(
                              row.consultant.id,
                              pr.projectId,
                              roleId,
                              weekKey.year,
                              w.week
                            );
                            const optimisticHours = optimisticCellHours[cellKey];
                            const effectiveDisplayHours =
                              optimisticHours != null ? optimisticHours : w.cell?.displayHours;
                            const hasBooking = (effectiveDisplayHours ?? 0) > 0;
                            const prevWeek = i > 0 ? pr.weeks[i - 1] : null;
                            const prevCellKey =
                              prevWeek && data.weeks[i - 1]
                                ? allocationCellKey(
                                    row.consultant.id,
                                    pr.projectId,
                                    prevWeek.cell?.roleId ??
                                      pr.weeks.find((x) => x.cell?.roleId)?.cell
                                        ?.roleId ??
                                      null,
                                    data.weeks[i - 1].year,
                                    prevWeek.week
                                  )
                                : "";
                            const prevEffective =
                              prevCellKey && optimisticCellHours[prevCellKey] != null
                                ? optimisticCellHours[prevCellKey]
                                : prevWeek?.cell?.displayHours;
                            const prevHasBooking = (prevEffective ?? 0) > 0;
                            const displayText =
                              w.cell?.isHidden && optimisticHours == null
                                ? "—"
                                : effectiveDisplayHours != null &&
                                    effectiveDisplayHours > 0
                                  ? `${effectiveDisplayHours}`
                                  : null;
                            const showLeftBorder = hasBooking && (i === 0 || !prevHasBooking);
                            const isEditingConsultant =
                              editingCellConsultant?.consultantId ===
                                row.consultant.id &&
                              editingCellConsultant?.projectId === pr.projectId &&
                              editingCellConsultant?.weekIndex === i;
                            const effectiveHours =
                              optimisticHours != null ? optimisticHours : (w.cell?.hours ?? 0);
                            const openEditorExt = () => {
                              setEditingCellConsultant({
                                consultantId: row.consultant.id,
                                projectId: pr.projectId,
                                roleId,
                                weekIndex: i,
                                week: w.week,
                                year: weekKey.year,
                                allocationId: w.cell?.id ?? null,
                                currentHours: effectiveHours,
                              });
                              setEditingCellConsultantValue(
                                String(effectiveHours)
                              );
                            };
                            const isProjectDragRangeExt =
                              projectRowDrag?.consultantId === row.consultant.id &&
                              projectRowDrag?.projectId === pr.projectId &&
                              i >= Math.min(projectRowDrag.weekIndexStart, projectRowDrag.weekIndexEnd) &&
                              i <= Math.max(projectRowDrag.weekIndexStart, projectRowDrag.weekIndexEnd);
                            return (
                            <td
                              key={`${weekKey.year}-${weekKey.week}`}
                              className={`${showLeftBorder ? "border-l border-grid-light-subtle " : ""}${hasBooking ? "border-r border-grid-light-subtle" : ""} p-0 py-1 text-center select-none cursor-pointer ${row.consultant.unavailableByWeek[i] ? "!bg-[var(--color-border-default)] text-text-primary" : ""} ${isCurrentWeek(data.weeks[i]) && !row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} ${isCurrentWeek(data.weeks[i]) && row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r" : ""} ${isEditingConsultant ? "align-middle" : ""} ${isProjectDragRangeExt ? "drag-range-cell border-t border-b border-l border-r border-brand-signal bg-brand-signal/20" : ""}`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setProjectRowDrag({
                                  consultantId: row.consultant.id,
                                  projectId: pr.projectId,
                                  roleId,
                                  consultantName: row.consultant.name,
                                  projectLabel: `${pr.customerName} - ${pr.projectName}`,
                                  roleName: pr.roleName ?? row.consultant.defaultRoleName ?? undefined,
                                  weekIndexStart: i,
                                  weekIndexEnd: i,
                                });
                                setProjectRowDragMoved(false);
                              }}
                              onMouseEnter={() => {
                                if (projectRowDrag?.consultantId === row.consultant.id && projectRowDrag?.projectId === pr.projectId) {
                                  setProjectRowDrag((prev) => (prev ? { ...prev, weekIndexEnd: i } : null));
                                  setProjectRowDragMoved(true);
                                }
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
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (preventNextCellClickRef.current) {
                                      preventNextCellClickRef.current = false;
                                      return;
                                    }
                                    openEditorExt();
                                  }}
                                  className="block w-full min-h-[1.5rem] cursor-pointer border-0 bg-transparent px-1 py-0.5 text-center text-[10px] text-text-primary hover:bg-bg-muted/50 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand-signal"
                                  tabIndex={0}
                                >
                                  {displayText ?? "\u00A0"}
                                </button>
                              )}
                            </td>
                          );
                          })}
                          <td className="border-r border-grid-light-subtle px-0 py-0.5 w-6 align-middle text-center">
                            {hasAnyBooking ? (
                              <button
                                type="button"
                                disabled={loadingDeleteBooking}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const roleId =
                                    pr.weeks.find((wk) => wk.cell?.roleId)?.cell?.roleId ?? null;
                                  setLoadingDeleteBooking(true);
                                  try {
                                    const list = await getBookingAllocationsForRow(
                                      row.consultant.id === TO_PLAN_CONSULTANT_ID ? null : row.consultant.id,
                                      pr.projectId,
                                      roleId
                                    );
                                    setDeleteBookingDialog({
                                      consultantId: row.consultant.id,
                                      consultantName: row.consultant.name,
                                      projectId: pr.projectId,
                                      projectLabel: `${pr.customerName} - ${pr.projectName}`,
                                      allocations: list.map((a) => ({
                                        allocationId: a.id,
                                        year: a.year,
                                        week: a.week,
                                      })),
                                      selectedAllocationIds: new Set(),
                                    });
                                  } catch (err) {
                                    alert(err instanceof Error ? err.message : "Failed to load booking");
                                  } finally {
                                    setLoadingDeleteBooking(false);
                                  }
                                }}
                                className="cursor-pointer inline-flex rounded p-0.5 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100 hover:text-danger focus:outline-none focus:ring-2 focus:ring-brand-signal disabled:opacity-50"
                                aria-label="Remove booking"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                      })}
                  </Fragment>
                );
              })}
                  </tbody>
                </table>
              </div>
              )}
            </>
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
              formatWeekLabel={formatWeekLabel}
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
                        className="rounded border-border"
                      />
                      <span>{formatWeekLabel(a.week, a.year)}</span>
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
