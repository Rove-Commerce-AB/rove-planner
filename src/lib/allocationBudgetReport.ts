import "server-only";

import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { getAllocationsForWeeks } from "@/lib/allocations";
import { addWeeksToYearWeek } from "@/lib/dateUtils";
import type {
  AllocationBudgetCustomerGroup,
  AllocationBudgetDrilldownResult,
  AllocationBudgetProjectRow,
} from "@/types/allocationBudgetReport";

function compareYearWeek(
  a: { year: number; week: number },
  b: { year: number; week: number }
): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.week - b.week;
}

/** Every ISO week from `start` through `end`, inclusive. Swaps if reversed. */
export function expandYearWeekRangeInclusive(
  start: { year: number; week: number },
  end: { year: number; week: number }
): { year: number; week: number }[] {
  let s = { ...start };
  let e = { ...end };
  if (compareYearWeek(s, e) > 0) {
    const t = s;
    s = e;
    e = t;
  }
  const out: { year: number; week: number }[] = [];
  let cur = { ...s };
  for (let guard = 0; guard < 600; guard++) {
    out.push({ ...cur });
    if (cur.year === e.year && cur.week === e.week) break;
    cur = addWeeksToYearWeek(cur.year, cur.week, 1);
  }
  return out;
}

type ProjectBudgetRow = {
  id: string;
  name: string;
  customer_id: string;
  budget_hours: string | number | null;
  customer_name: string;
};

async function fetchProjectBudgetRows(
  projectIds: string[]
): Promise<ProjectBudgetRow[]> {
  if (projectIds.length === 0) return [];
  const { rows } = await cloudSqlPool.query<ProjectBudgetRow>(
    `SELECT p.id, p.name, p.customer_id, p.budget_hours,
            c.name AS customer_name
     FROM projects p
     INNER JOIN customers c ON c.id = p.customer_id
     WHERE p.id = ANY($1::uuid[])`,
    [projectIds]
  );
  return rows;
}

/**
 * Planned hours summed over the given weeks, grouped by customer → project,
 * with project budget hours when configured.
 */
export async function getAllocationBudgetDrilldown(
  weeks: { year: number; week: number }[]
): Promise<AllocationBudgetDrilldownResult> {
  if (weeks.length === 0) {
    return {
      weekCount: 0,
      range: { fromYear: 0, fromWeek: 0, toYear: 0, toWeek: 0 },
      customers: [],
    };
  }

  const sorted = [...weeks].sort(compareYearWeek);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  const allocations = await getAllocationsForWeeks(weeks);
  const byProject = new Map<string, number>();
  for (const a of allocations) {
    const prev = byProject.get(a.project_id) ?? 0;
    byProject.set(a.project_id, prev + a.hours);
  }

  const projectIds = [...byProject.keys()];
  const projectRows = await fetchProjectBudgetRows(projectIds);

  const byCustomer = new Map<
    string,
    { customerName: string; projects: Map<string, AllocationBudgetProjectRow> }
  >();

  for (const p of projectRows) {
    const allocated = byProject.get(p.id) ?? 0;
    const budgetHours =
      p.budget_hours != null ? Number(p.budget_hours) : null;
    const row: AllocationBudgetProjectRow = {
      projectId: p.id,
      projectName: p.name ?? "Unknown",
      allocatedHours: allocated,
      budgetHours: Number.isFinite(budgetHours) ? budgetHours : null,
    };

    let bucket = byCustomer.get(p.customer_id);
    if (!bucket) {
      bucket = {
        customerName: p.customer_name ?? "Unknown",
        projects: new Map(),
      };
      byCustomer.set(p.customer_id, bucket);
    }
    bucket.projects.set(p.id, row);
  }

  const customers: AllocationBudgetCustomerGroup[] = [...byCustomer.entries()]
    .map(([customerId, { customerName, projects }]) => {
      const projectList = [...projects.values()].sort((a, b) =>
        a.projectName.localeCompare(b.projectName, undefined, {
          sensitivity: "base",
        })
      );
      const allocatedHours = projectList.reduce(
        (s, r) => s + r.allocatedHours,
        0
      );
      return {
        customerId,
        customerName,
        allocatedHours,
        projects: projectList,
      };
    })
    .sort((a, b) =>
      a.customerName.localeCompare(b.customerName, undefined, {
        sensitivity: "base",
      })
    );

  return {
    weekCount: weeks.length,
    range: {
      fromYear: first.year,
      fromWeek: first.week,
      toYear: last.year,
      toWeek: last.week,
    },
    customers,
  };
}
