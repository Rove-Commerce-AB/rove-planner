"use server";

import {
  getActiveProjectsForCustomer,
  getJiraDevOpsOptionsForProject,
  getTaskOptionsForCustomerAndProject,
  getWorkIssueOptionsForCustomer,
  getHolidayDatesForWeek,
  getHolidayDatesForRange,
  getTimeReportEntries,
  getTimeReportEntriesForWeeks,
  saveTimeReportEntries,
  copyEntryToWeek,
  copyTimeReportEntriesBatch,
  batchHydrateTimeReport,
  getTimeReportWeekRevision,
  getTimeReportWeekRevisions,
} from "@/lib/timeReportEntries";
import { getTimeReportSummary } from "@/lib/timeReportSummary";

export {
  getActiveProjectsForCustomer,
  getJiraDevOpsOptionsForProject,
  getTaskOptionsForCustomerAndProject,
  getWorkIssueOptionsForCustomer,
  getHolidayDatesForWeek,
  getHolidayDatesForRange,
  getTimeReportEntries,
  getTimeReportEntriesForWeeks,
  saveTimeReportEntries,
  copyEntryToWeek,
  copyTimeReportEntriesBatch,
  batchHydrateTimeReport,
  getTimeReportWeekRevision,
  getTimeReportWeekRevisions,
};

export async function getTimeReportSummaryAction(year: number) {
  return getTimeReportSummary(year);
}
