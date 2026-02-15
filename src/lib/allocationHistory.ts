/**
 * Allocation history: read-side logic for the audit log.
 * Types live in @/types. Write-side (log, deleteWithHistory) in allocation/actions.ts.
 */

import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("allocation_history")
    .select("id, allocation_id, action, changed_by_email, changed_at, details")
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (error) return [];

  const allocationIds = [
    ...new Set(
      (rows ?? [])
        .filter((r) => r.allocation_id != null)
        .map((r) => r.allocation_id as string)
    ),
  ];
  const bulkIds = (rows ?? []).flatMap((r) =>
    r.details && Array.isArray(r.details.allocation_ids)
      ? r.details.allocation_ids
      : []
  );
  const allIds = [...new Set([...allocationIds, ...bulkIds])];

  let allocMap: Map<string, AllocMapValue> = new Map();
  if (allIds.length > 0) {
    const { data: allocs } = await supabase
      .from("allocations")
      .select("id, year, week, hours, project_id, consultant_id")
      .in("id", allIds);
    if (allocs && allocs.length > 0) {
      const projectIds = [...new Set(allocs.map((a) => a.project_id))];
      const consultantIds = [
        ...new Set(
          allocs.map((a) => a.consultant_id).filter(Boolean) as string[]
        ),
      ];
      const [projRes, consRes] = await Promise.all([
        projectIds.length > 0
          ? supabase
              .from("projects")
              .select("id, name, customer_id")
              .in("id", projectIds)
          : { data: [] },
        consultantIds.length > 0
          ? supabase
              .from("consultants")
              .select("id, name")
              .in("id", consultantIds)
          : { data: [] },
      ]);
      const projects = (projRes.data ?? []) as Array<{
        id: string;
        name: string;
        customer_id: string;
      }>;
      const projectsByName = new Map(projects.map((p) => [p.id, p]));
      const customerIds = [
        ...new Set(projects.map((p) => p.customer_id).filter(Boolean)),
      ] as string[];
      const { data: custData } =
        customerIds.length > 0
          ? await supabase
              .from("customers")
              .select("id, name")
              .in("id", customerIds)
          : { data: [] };
      const customersByName = new Map(
        (custData ?? []).map((c) => [c.id, c.name])
      );
      const consultantsByName = new Map(
        (consRes.data ?? []).map((c) => [c.id, c.name])
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
          hours: a.hours,
        });
      }
    }
  }

  return (rows ?? []).map((r) => mapRowToEntry(r, allocMap));
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
