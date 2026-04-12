/**
 * Allocation history: read-side logic for the audit log.
 * Types live in @/types. Write-side (log, deleteWithHistory) in lib/allocationWrite.ts; server actions re-export.
 */

import { cloudSqlPool } from "@/lib/cloudSqlPool";
import type { AllocationHistoryDetails, AllocationHistoryEntry } from "@/types";

export type { AllocationHistoryDetails, AllocationHistoryEntry };

type AllocMapValue = {
  project_name: string;
  customer_name: string | null;
  consultant_name: string | null;
  year: number;
  week: number;
  hours: number;
};

export async function fetchAllocationHistory(
  limit = 100
): Promise<AllocationHistoryEntry[]> {
  const { rows } = await cloudSqlPool.query<{
    id: string;
    allocation_id: string | null;
    action: string;
    changed_by_email: string;
    changed_at: string;
    details: unknown;
  }>(
    `SELECT id, allocation_id, action, changed_by_email, changed_at::text, details
     FROM allocation_history
     ORDER BY changed_at DESC
     LIMIT $1`,
    [limit]
  );

  const allocationIds = [
    ...new Set(
      rows
        .filter((r) => r.allocation_id != null)
        .map((r) => r.allocation_id as string)
    ),
  ];
  const bulkIds = rows.flatMap((r) => {
    const d = r.details as AllocationHistoryDetails | null;
    return d && Array.isArray(d.allocation_ids) ? d.allocation_ids : [];
  });
  const allIds = [...new Set([...allocationIds, ...bulkIds])];

  let allocMap: Map<string, AllocMapValue> = new Map();
  if (allIds.length > 0) {
    const { rows: allocs } = await cloudSqlPool.query<{
      id: string;
      year: number;
      week: number;
      hours: string | number;
      project_id: string;
      consultant_id: string | null;
    }>(
      `SELECT id, year, week, hours, project_id, consultant_id
       FROM allocations WHERE id = ANY($1::uuid[])`,
      [allIds]
    );
    if (allocs.length > 0) {
      const projectIds = [...new Set(allocs.map((a) => a.project_id))];
      const consultantIds = [
        ...new Set(allocs.map((a) => a.consultant_id).filter(Boolean) as string[]),
      ];
      const [projRows, consRows] = await Promise.all([
        projectIds.length > 0
          ? cloudSqlPool.query<{
              id: string;
              name: string;
              customer_id: string;
            }>(
              `SELECT id, name, customer_id FROM projects WHERE id = ANY($1::uuid[])`,
              [projectIds]
            )
          : Promise.resolve({ rows: [] as never[] }),
        consultantIds.length > 0
          ? cloudSqlPool.query<{ id: string; name: string }>(
              `SELECT id, name FROM consultants WHERE id = ANY($1::uuid[])`,
              [consultantIds]
            )
          : Promise.resolve({ rows: [] as never[] }),
      ]);
      const projects = projRows.rows;
      const projectsByName = new Map(projects.map((p) => [p.id, p]));
      const customerIds = [
        ...new Set(projects.map((p) => p.customer_id).filter(Boolean)),
      ] as string[];
      const custRes =
        customerIds.length > 0
          ? await cloudSqlPool.query<{ id: string; name: string }>(
              `SELECT id, name FROM customers WHERE id = ANY($1::uuid[])`,
              [customerIds]
            )
          : { rows: [] as { id: string; name: string }[] };
      const customersByName = new Map(custRes.rows.map((c) => [c.id, c.name]));
      const consultantsByName = new Map(
        consRows.rows.map((c) => [c.id, c.name])
      );
      for (const a of allocs) {
        const proj = projectsByName.get(a.project_id);
        const customerName = proj?.customer_id
          ? customersByName.get(proj.customer_id) ?? null
          : null;
        allocMap.set(a.id, {
          project_name: proj?.name ?? "—",
          customer_name: customerName ?? null,
          consultant_name: a.consultant_id
            ? consultantsByName.get(a.consultant_id) ?? null
            : "To plan",
          year: a.year,
          week: a.week,
          hours: Number(a.hours),
        });
      }
    }
  }

  return rows.map((r) => mapRowToEntry(r, allocMap));
}

function mapRowToEntry(
  r: {
    id: string;
    allocation_id: string | null;
    action: string;
    changed_by_email: string;
    changed_at: string;
    details: unknown;
  },
  allocMap: Map<string, AllocMapValue>
): AllocationHistoryEntry {
  const details = r.details as AllocationHistoryDetails | null;
  const bulkIds = details?.allocation_ids ?? [];
  const alloc =
    r.allocation_id != null
      ? allocMap.get(r.allocation_id)
      : bulkIds.length > 0
        ? allocMap.get(bulkIds[0])
        : null;
  const bulkAllocs =
    r.action === "bulk" && bulkIds.length > 0
      ? (bulkIds
          .map((id) => allocMap.get(id))
          .filter(Boolean) as AllocMapValue[])
      : [];
  const weekRange =
    r.action === "delete" && details?.week_range_removed
      ? details.week_range_removed
      : r.action === "bulk" && details?.week_range
        ? details.week_range
        : bulkAllocs.length > 0
          ? (() => {
              const min = bulkAllocs.reduce(
                (a, b) =>
                  a.year < b.year || (a.year === b.year && a.week < b.week)
                    ? a
                    : b,
                bulkAllocs[0]
              );
              const max = bulkAllocs.reduce(
                (a, b) =>
                  a.year > b.year || (a.year === b.year && a.week > b.week)
                    ? a
                    : b,
                bulkAllocs[0]
              );
              if (min.year === max.year && min.week === max.week)
                return `${min.week}`;
              if (min.year === max.year) return `${min.week}–${max.week}`;
              return `${min.year}-${min.week} – ${max.year}-${max.week}`;
            })()
          : null;
  const totalHours =
    bulkAllocs.length > 0
      ? bulkAllocs.reduce((s, a) => s + a.hours, 0)
      : null;
  const displayHours =
    details?.hours_after != null
      ? details.hours_after
      : details?.hours != null
        ? details.hours
        : details?.hours_removed != null
          ? details.hours_removed
          : alloc?.hours ?? (totalHours != null ? totalHours : null);
  return {
    id: r.id,
    allocation_id: r.allocation_id,
    action: r.action as AllocationHistoryEntry["action"],
    changed_by_email: r.changed_by_email,
    changed_at: r.changed_at,
    details,
    project_name: details?.project_name ?? alloc?.project_name ?? null,
    customer_name: details?.customer_name ?? alloc?.customer_name ?? null,
    consultant_name:
      details?.consultant_name ?? alloc?.consultant_name ?? null,
    year: details?.year ?? alloc?.year ?? null,
    week: details?.week ?? alloc?.week ?? null,
    hours: displayHours ?? null,
    week_range: weekRange,
    total_hours: totalHours ?? null,
  };
}
