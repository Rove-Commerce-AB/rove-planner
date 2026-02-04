"use server";

import { getAvailableHoursForConsultantWeek } from "@/lib/consultants";
import { createAllocationsForWeekRangeWithGetter } from "@/lib/allocations";

export async function createAllocationsByPercent(
  consultantId: string,
  projectId: string,
  roleId: string | null,
  year: number,
  weekFrom: number,
  weekTo: number,
  percent: number
): Promise<void> {
  const pct = Math.max(0, Math.min(100, percent)) / 100;
  await createAllocationsForWeekRangeWithGetter(
    consultantId,
    projectId,
    roleId,
    year,
    weekFrom,
    weekTo,
    async (y, w) => {
      const available = await getAvailableHoursForConsultantWeek(
        consultantId,
        y,
        w
      );
      return Math.round((available * pct) * 100) / 100;
    }
  );
}
