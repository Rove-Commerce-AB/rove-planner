"use server";

import { getOccupancyReportData } from "@/lib/occupancyReport";
import type { OccupancyReportResult } from "@/types/occupancyReport";
import { assertNotSubcontractorForWrite } from "@/lib/accessGuards";

export async function getOccupancyReportDataAction(
  weeks: { year: number; week: number }[],
  roleId: string | null,
  teamId?: string | null
): Promise<OccupancyReportResult> {
  await assertNotSubcontractorForWrite();
  return getOccupancyReportData(weeks, roleId, teamId);
}
