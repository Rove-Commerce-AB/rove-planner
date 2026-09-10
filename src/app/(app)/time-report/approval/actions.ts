"use server";

import {
  getProjectManagerTimeEntries as getProjectManagerTimeEntriesRaw,
  pmUpdateTimeEntry as pmUpdateTimeEntryRaw,
  pmSetInvoicingStatus as pmSetInvoicingStatusRaw,
  pmSetInvoicingStatusBulk as pmSetInvoicingStatusBulkRaw,
  pmSetProjectMonthInvoicedHoursFixed as pmSetProjectMonthInvoicedHoursFixedRaw,
} from "@/lib/projectManagerTimeReport";
import { assertNotSubcontractorForWrite } from "@/lib/accessGuards";

export async function getProjectManagerTimeEntries(args: {
  projectId: string;
  year: number;
  month: number;
}) {
  await assertNotSubcontractorForWrite();
  return getProjectManagerTimeEntriesRaw(args);
}

export async function pmUpdateTimeEntry(args: {
  entryId: string;
  pmHours?: number | null;
  pmComment: string;
  markInvoicing: boolean;
}) {
  await assertNotSubcontractorForWrite();
  return pmUpdateTimeEntryRaw(args);
}

export async function pmSetInvoicingStatus(args: { entryId: string; ready: boolean }) {
  await assertNotSubcontractorForWrite();
  return pmSetInvoicingStatusRaw(args);
}

export async function pmSetInvoicingStatusBulk(args: {
  entryIds: string[];
  ready: boolean;
}) {
  await assertNotSubcontractorForWrite();
  return pmSetInvoicingStatusBulkRaw(args);
}

export async function pmSetProjectMonthInvoicedHoursFixed(args: {
  projectId: string;
  year: number;
  month: number;
  invoicedHoursFixed: number | null;
}) {
  await assertNotSubcontractorForWrite();
  return pmSetProjectMonthInvoicedHoursFixedRaw(args);
}
