"use server";

import { revalidateTag } from "next/cache";
import { getAvailableHoursForConsultantWeek } from "@/lib/consultants";
import { createAllocationsForWeekRangeWithGetter } from "@/lib/allocations";
import {
  logBulkAllocationHistory,
  logAllocationHistory,
  logAllocationHistoryCreate,
  logAllocationHistoryUpdate,
  getBookingAllocationsForRow,
  deleteAllocationWithHistory,
  deleteAllocationsWithHistory,
} from "@/lib/allocationWrite";
import type { AllocationHistoryEntry } from "@/types";
import {
  getAllocationPageData,
  getAllocationPageDataForProject,
} from "@/lib/allocationPage";
import type { AllocationPageData } from "@/lib/allocationPageTypes";

export async function revalidateAllocationPage(): Promise<void> {
  revalidateTag("allocation-page", "max");
}

export async function getAllocationHistory(
  limit = 100
): Promise<AllocationHistoryEntry[]> {
  const { fetchAllocationHistory } = await import("@/lib/allocationHistory");
  return fetchAllocationHistory(limit);
}

export {
  logAllocationHistory,
  logAllocationHistoryCreate,
  logAllocationHistoryUpdate,
  logBulkAllocationHistory,
  getBookingAllocationsForRow,
  deleteAllocationWithHistory,
  deleteAllocationsWithHistory,
};

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
          return Math.round(available * pct * 100) / 100;
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

export async function getAllocationData(
  year: number,
  weekFrom: number,
  weekTo: number
): Promise<{ data: AllocationPageData | null; error: string | null }> {
  try {
    const data = await getAllocationPageData(year, weekFrom, weekTo);
    return { data, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load allocation data";
    return { data: null, error: message };
  }
}

export async function getProjectAllocationData(
  projectId: string,
  customerId: string,
  year: number,
  weekFrom: number,
  weekTo: number
): Promise<{ data: AllocationPageData | null; error: string | null }> {
  try {
    const data = await getAllocationPageDataForProject(
      projectId,
      customerId,
      year,
      weekFrom,
      weekTo
    );
    return { data, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load planning data";
    return { data: null, error: message };
  }
}
