import type { AllocationPageData } from "@/lib/allocationPageTypes";
import { TO_PLAN_CONSULTANT_ID } from "@/lib/allocationPageTypes";
import { DEFAULT_CUSTOMER_COLOR } from "@/lib/constants";

export type ProbabilityDisplay = "weighted" | "none";
export type ProjectVisibility = "all" | "hideNon100" | "hide100";

export function getProjectProbabilityMap(
  projects: AllocationPageData["projects"]
): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of projects) {
    m.set(p.id, p.probability != null ? p.probability : 100);
  }
  return m;
}

export function getDisplayHours(
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

export function buildPerConsultantView(
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
      {
        name: p.name,
        customerName: p.customerName,
        customerColor: p.customerColor,
        customer_id: p.customer_id,
      },
    ])
  );

  const weekKey = (y: number, w: number) => `${y}-${w}`;
  const byConsultant = new Map<
    string,
    Map<
      string,
      Map<string, { id: string; hours: number; roleName: string; roleId: string | null }>
    >
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
      roleName: a.role_id ? (roleMap.get(a.role_id) ?? "Unknown") : "",
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
            ? (projectRowKey.split("\0")[0] ?? projectRowKey)
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
          showProbabilitySymbol: showProbabilitySymbol(
            projectId,
            probabilityDisplay,
            projectVisibility,
            projectProbabilityMap
          ),
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

export function buildPerCustomerView(
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

  const byCustomerProject = new Map<
    string,
    Map<
      string,
      Map<
        string,
        Map<
          string,
          {
            id: string;
            projectId: string;
            hours: number;
            roleName: string;
            roleId: string | null;
            projectName: string;
          }[]
        >
      >
    >
  >();

  for (const a of data.allocations) {
    const proj = projectMap.get(a.project_id);
    if (!proj) continue;
    const customerId = proj.customer_id;
    const projectName = proj.name ?? "Unknown";
    const roleId = a.role_id ?? null;
    const roleName = roleId ? (roleMap.get(roleId) ?? "Unknown") : "";
    const rowKey = keyFor(a.consultant_id ?? TO_PLAN_CONSULTANT_ID, roleId);

    if (!byCustomerProject.has(customerId)) {
      byCustomerProject.set(customerId, new Map());
    }
    const byProject = byCustomerProject.get(customerId)!;
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

  const sortedCustomers = [...data.customers].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return sortedCustomers.map((cust) => {
    const byProject = byCustomerProject.get(cust.id);
    const consultantMap = new Map(data.consultants.map((c) => [c.id, c]));
    const projectGroups: {
      project: { id: string; name: string };
      consultantRows: {
        consultantId: string;
        consultantName: string;
        roleId: string | null;
        roleName: string;
        unavailableByWeek: boolean[];
        weeks: { week: number; cells: CustomerViewCellItem[] }[];
      }[];
      totalByWeek: Map<string, number>;
    }[] = [];

    if (byProject) {
      const sortedProjectIds = [...byProject.keys()].sort((a, b) => {
        const aName = projectMap.get(a)?.name ?? "";
        const bName = projectMap.get(b)?.name ?? "";
        return aName.localeCompare(bName);
      });

      for (const projectId of sortedProjectIds) {
        const byConsultantRole = byProject.get(projectId)!;
        const consultantRows: {
          consultantId: string;
          consultantName: string;
          roleId: string | null;
          roleName: string;
          unavailableByWeek: boolean[];
          weeks: { week: number; cells: CustomerViewCellItem[] }[];
        }[] = [];
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
          const roleA = a.roleId ? (roleMap.get(a.roleId) ?? "") : "";
          const roleB = b.roleId ? (roleMap.get(b.roleId) ?? "") : "";
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
            roleName: roleId ? (roleMap.get(roleId) ?? "Unknown") : "",
            unavailableByWeek: c?.unavailableByWeek ?? data.weeks.map(() => false),
            weeks,
          });
        }

        const projectTotalByWeek = new Map<string, number>();
        for (const cr of consultantRows) {
          cr.weeks.forEach(({ cells }, j) => {
            const w = data.weeks[j];
            const sum = cells.reduce(
              (s, x) => s + (x.isHidden ? 0 : x.displayHours),
              0
            );
            if (sum > 0 && w) {
              const key = weekKey(w.year, w.week);
              projectTotalByWeek.set(key, (projectTotalByWeek.get(key) ?? 0) + sum);
            }
          });
        }

        projectGroups.push({
          project: {
            id: projectId,
            name: projectMap.get(projectId)?.name ?? "Unknown",
          },
          consultantRows,
          totalByWeek: projectTotalByWeek,
        });
      }
    }

    const totalByWeek = new Map<string, number>();
    for (const pg of projectGroups) {
      for (const [k, v] of pg.totalByWeek) {
        totalByWeek.set(k, (totalByWeek.get(k) ?? 0) + v);
      }
    }

    return {
      customer: cust,
      projectGroups,
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

export function buildPerProjectView(
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
    Map<
      string,
      Map<
        string,
        {
          id: string;
          projectId: string;
          hours: number;
          roleName: string;
          roleId: string | null;
          projectName: string;
        }[]
      >
    >
  >();

  for (const a of data.allocations) {
    const proj = projectMap.get(a.project_id);
    if (!proj) continue;
    const projectName = proj.name;
    const roleId = a.role_id ?? null;
    const roleName = roleId ? (roleMap.get(roleId) ?? "Unknown") : "";
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
    .filter((p) => p.isActive !== false && p.customerIsActive !== false)
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
        const roleA = a.roleId ? (roleMap.get(a.roleId) ?? "") : "";
        const roleB = b.roleId ? (roleMap.get(b.roleId) ?? "") : "";
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
          roleName: roleId ? (roleMap.get(roleId) ?? "Unknown") : "",
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
        showProbabilitySymbol: showProbabilitySymbol(
          proj.id,
          probabilityDisplay,
          projectVisibility,
          projectProbabilityMap
        ),
      },
      consultantRows,
      totalByWeek,
    };
  });
}
