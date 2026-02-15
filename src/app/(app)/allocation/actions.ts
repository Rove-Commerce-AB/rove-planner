"use server";

import { revalidateTag } from "next/cache";
import { getAvailableHoursForConsultantWeek } from "@/lib/consultants";
import { createAllocationsForWeekRangeWithGetter } from "@/lib/allocations";
import { getCurrentAppUser } from "@/lib/appUsers";
import { createClient } from "@/lib/supabase/server";
import type { AllocationHistoryDetails, AllocationHistoryEntry } from "@/types";

/** Call after any allocation create/update/delete so allocation page cache shows fresh data. */
export async function revalidateAllocationPage(): Promise<void> {
  revalidateTag("allocation-page", "max");
}

/** Fetch recent allocation history for the Allocation history tab. */
export async function getAllocationHistory(
  limit = 100
): Promise<AllocationHistoryEntry[]> {
  const { fetchAllocationHistory } = await import("@/lib/allocationHistory");
  return fetchAllocationHistory(limit);
}

/** Log one allocation history entry. Prefer snapshot helpers for create/update/bulk so history shows data at CRUD time. */
export async function logAllocationHistory(
  allocationId: string | null,
  action: "create" | "update" | "delete" | "bulk",
  details?: AllocationHistoryDetails
): Promise<void> {
  const user = await getCurrentAppUser();
  const email = user?.email ?? "unknown";
  const supabase = await createClient();
  await supabase.from("allocation_history").insert({
    allocation_id: allocationId,
    action,
    changed_by_email: email,
    details: details ?? null,
  });
}

/** Log create with snapshot so history shows project/customer/consultant even after delete. */
export async function logAllocationHistoryCreate(allocationId: string): Promise<void> {
  const supabase = await createClient();
  const snapshot = await getAllocationSnapshot(supabase, allocationId);
  await logAllocationHistory(allocationId, "create", snapshot ? {
    project_name: snapshot.project_name,
    customer_name: snapshot.customer_name ?? undefined,
    consultant_name: snapshot.consultant_name,
    year: snapshot.year,
    week: snapshot.week,
    hours: snapshot.hours,
  } : { hours: undefined });
}

/** Log update with snapshot so history shows context even after delete. */
export async function logAllocationHistoryUpdate(allocationId: string, hours_after: number): Promise<void> {
  const supabase = await createClient();
  const snapshot = await getAllocationSnapshot(supabase, allocationId);
  await logAllocationHistory(allocationId, "update", snapshot ? {
    project_name: snapshot.project_name,
    customer_name: snapshot.customer_name ?? undefined,
    consultant_name: snapshot.consultant_name,
    year: snapshot.year,
    week: snapshot.week,
    hours_after,
  } : { hours_after });
}

/** Log bulk create with snapshot (first allocation) and week range so history shows context even after delete. */
export async function logBulkAllocationHistory(
  allocationIds: string[],
  totalHours: number
): Promise<void> {
  if (allocationIds.length === 0) return;
  const supabase = await createClient();
  const snapshot = await getAllocationSnapshot(supabase, allocationIds[0]);
  let week_range: string | undefined;
  if (allocationIds.length > 0) {
    const { data: allocs } = await supabase
      .from("allocations")
      .select("year, week")
      .in("id", allocationIds);
    if (allocs && allocs.length > 0) {
      const weeks = allocs.map((a) => ({ year: a.year, week: a.week }));
      const min = weeks.reduce((a, b) => (a.year < b.year || (a.year === b.year && a.week < b.week) ? a : b), weeks[0]);
      const max = weeks.reduce((a, b) => (a.year > b.year || (a.year === b.year && a.week > b.week) ? a : b), weeks[0]);
      week_range = min.year === max.year && min.week === max.week
        ? String(min.week)
        : min.year === max.year
          ? `${min.week}–${max.week}`
          : `${min.year}-${min.week} – ${max.year}-${max.week}`;
    }
  }
  await logAllocationHistory(null, "bulk", {
    allocation_ids: allocationIds,
    hours: totalHours,
    project_name: snapshot?.project_name,
    customer_name: snapshot?.customer_name ?? undefined,
    consultant_name: snapshot?.consultant_name,
    week_range,
  });
}

/** Fetch allocation by id and resolve project/consultant/customer names. */
async function getAllocationSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  allocationId: string
): Promise<{
  project_name: string;
  customer_name: string | null;
  consultant_name: string;
  year: number;
  week: number;
  hours: number;
} | null> {
  const { data: a } = await supabase
    .from("allocations")
    .select("id, year, week, hours, project_id, consultant_id")
    .eq("id", allocationId)
    .single();
  if (!a) return null;
  const { data: proj } = await supabase
    .from("projects")
    .select("id, name, customer_id")
    .eq("id", a.project_id)
    .single();
  let customer_name: string | null = null;
  if (proj?.customer_id) {
    const { data: cust } = await supabase
      .from("customers")
      .select("name")
      .eq("id", proj.customer_id)
      .single();
    customer_name = cust?.name ?? null;
  }
  let consultant_name = "To plan";
  if (a.consultant_id) {
    const { data: cons } = await supabase
      .from("consultants")
      .select("name")
      .eq("id", a.consultant_id)
      .single();
    consultant_name = cons?.name ?? "—";
  }
  return {
    project_name: proj?.name ?? "—",
    customer_name,
    consultant_name,
    year: a.year,
    week: a.week,
    hours: Number(a.hours),
  };
}

/** Delete one allocation after logging to history (with snapshot so delete row shows data). */
export async function deleteAllocationWithHistory(
  allocationId: string
): Promise<void> {
  const supabase = await createClient();
  const snapshot = await getAllocationSnapshot(supabase, allocationId);
  const user = await getCurrentAppUser();
  const email = user?.email ?? "unknown";
  await supabase.from("allocation_history").insert({
    allocation_id: allocationId,
    action: "delete",
    changed_by_email: email,
    details: snapshot
      ? {
          customer_name: snapshot.customer_name ?? undefined,
          project_name: snapshot.project_name,
          consultant_name: snapshot.consultant_name,
          week_range_removed: String(snapshot.week),
          hours_removed: snapshot.hours,
        }
      : null,
  });
  await supabase.from("allocations").delete().eq("id", allocationId);
  revalidateTag("allocation-page", "max");
}

/** Delete multiple allocations; log one history row with week range e.g. "9-12". */
export async function deleteAllocationsWithHistory(
  allocationIds: string[]
): Promise<void> {
  if (allocationIds.length === 0) return;
  const supabase = await createClient();
  const { data: allocs } = await supabase
    .from("allocations")
    .select("id, year, week, hours, project_id, consultant_id")
    .in("id", allocationIds);
  if (!allocs || allocs.length === 0) {
    await supabase.from("allocations").delete().in("id", allocationIds);
    revalidateTag("allocation-page", "max");
    return;
  }
  const firstId = allocs[0].id;
  const snapshot = await getAllocationSnapshot(supabase, firstId);
  const weeks = allocs.map((a) => a.week).sort((a, b) => a - b);
  const weekRange =
    weeks.length === 1
      ? String(weeks[0])
      : `${weeks[0]}-${weeks[weeks.length - 1]}`;
  const totalHours = allocs.reduce((s, a) => s + Number(a.hours), 0);
  const user = await getCurrentAppUser();
  const email = user?.email ?? "unknown";
  await supabase.from("allocation_history").insert({
    allocation_id: null,
    action: "delete",
    changed_by_email: email,
    details: {
      allocation_ids: allocationIds,
      customer_name: snapshot?.customer_name ?? undefined,
      project_name: snapshot?.project_name,
      consultant_name: snapshot?.consultant_name,
      week_range_removed: weekRange,
      hours_removed: totalHours,
    },
  });
  await supabase.from("allocations").delete().in("id", allocationIds);
  revalidateTag("allocation-page", "max");
}

/** When consultantId is null ("To plan"), percent is applied to a fixed 40h/week. */
export async function createAllocationsByPercent(
  consultantId: string | null,
  projectId: string,
  roleId: string | null,
  year: number,
  weekFrom: number,
  weekTo: number,
  percent: number
): Promise<void> {
  const pct = Math.max(0, Math.min(100, percent)) / 100;
  const records = await createAllocationsForWeekRangeWithGetter(
    consultantId,
    projectId,
    roleId,
    year,
    weekFrom,
    weekTo,
    consultantId === null
      ? async () => Math.round(40 * pct * 100) / 100
      : async (y, w) => {
          const available = await getAvailableHoursForConsultantWeek(
            consultantId,
            y,
            w
          );
          return Math.round((available * pct) * 100) / 100;
        }
  );
  revalidateTag("allocation-page", "max");
  if (records.length > 0) {
    void logBulkAllocationHistory(
      records.map((r) => r.id),
      records.reduce((s, r) => s + r.hours, 0)
    );
  }
}
