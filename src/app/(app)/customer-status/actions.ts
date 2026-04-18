"use server";

import { revalidatePath } from "next/cache";
import {
  addCustomerStatusEntry,
  deleteCustomerStatusEntry,
  listCustomerStatusHistory,
  updateCustomerStatusEntry,
} from "@/lib/customerStatus";
import type { CustomerStatusEntrySerialized } from "@/lib/customerStatusShared";
import { assertNotSubcontractorForWrite } from "@/lib/accessGuards";

export type AddCustomerStatusResult =
  | { ok: true }
  | { ok: false; error: string };

export async function addCustomerStatusEntryAction(
  customerId: string,
  trafficLight: string,
  body: string
): Promise<AddCustomerStatusResult> {
  try {
    await assertNotSubcontractorForWrite();
    await addCustomerStatusEntry(customerId, trafficLight, body);
    revalidatePath("/customer-status");
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not save customer status.";
    if (message === "Unauthorized") {
      return { ok: false, error: "You do not have permission to save status." };
    }
    return { ok: false, error: message };
  }
}

export async function getCustomerStatusHistoryAction(
  customerId: string
): Promise<
  | { ok: true; entries: CustomerStatusEntrySerialized[] }
  | { ok: false; error: string }
> {
  try {
    await assertNotSubcontractorForWrite();
    const entries = await listCustomerStatusHistory(customerId);
    const serialized: CustomerStatusEntrySerialized[] = entries.map((e) => ({
      ...e,
      created_at: e.created_at.toISOString(),
    }));
    return { ok: true, entries: serialized };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not load history.";
    if (message === "Unauthorized") {
      return { ok: false, error: "You do not have permission to view history." };
    }
    return { ok: false, error: message };
  }
}

export async function updateCustomerStatusEntryAction(
  entryId: string,
  customerId: string,
  trafficLight: string,
  body: string
): Promise<AddCustomerStatusResult> {
  try {
    await assertNotSubcontractorForWrite();
    await updateCustomerStatusEntry(entryId, customerId, trafficLight, body);
    revalidatePath("/customer-status");
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not update customer status.";
    if (message === "Unauthorized") {
      return {
        ok: false,
        error: "You do not have permission to update status.",
      };
    }
    return { ok: false, error: message };
  }
}

export async function deleteCustomerStatusEntryAction(
  entryId: string,
  customerId: string
): Promise<AddCustomerStatusResult> {
  try {
    await assertNotSubcontractorForWrite();
    await deleteCustomerStatusEntry(entryId, customerId);
    revalidatePath("/customer-status");
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not delete customer status.";
    if (message === "Unauthorized") {
      return {
        ok: false,
        error: "You do not have permission to delete status.",
      };
    }
    return { ok: false, error: message };
  }
}
