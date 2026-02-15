"use server";

import { revalidateTag } from "next/cache";
import { getAvailableHoursForConsultantWeek } from "@/lib/consultants";
import { createAllocationsForWeekRangeWithGetter } from "@/lib/allocations";

/** Call after any allocation create/update/delete so allocation page cache shows fresh data. */
export async function revalidateAllocationPage(): Promise<void> {
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
  await createAllocationsForWeekRangeWithGetter(
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
}
