"use server";

import { getOccupancyReportData } from "@/lib/occupancyReport";
import type { OccupancyReportResult } from "@/lib/occupancyReport";

export async function getOccupancyReportDataAction(
  weeks: { year: number; week: number }[],
  roleId: string | null
): Promise<OccupancyReportResult> {
  return getOccupancyReportData(weeks, roleId);
}
