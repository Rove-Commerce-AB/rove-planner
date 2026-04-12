"use server";

import { revalidatePath } from "next/cache";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomersWithDetails,
} from "@/lib/customers";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@/lib/customers";
import type { Customer } from "@/lib/customers";
import { assertAdmin, assertNotSubcontractorForWrite } from "@/lib/accessGuards";

export async function revalidateCustomers() {
  await assertNotSubcontractorForWrite();
  revalidatePath("/customers");
}

export async function createCustomerAction(
  input: CreateCustomerInput
): Promise<Customer> {
  await assertNotSubcontractorForWrite();
  const customer = await createCustomer(input);
  revalidatePath("/customers");
  return customer;
}

export async function updateCustomerAction(
  id: string,
  input: UpdateCustomerInput
): Promise<Customer> {
  await assertNotSubcontractorForWrite();
  const customer = await updateCustomer(id, input);
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return customer;
}

export async function deleteCustomerAction(id: string): Promise<void> {
  await assertAdmin();
  await deleteCustomer(id);
  revalidatePath("/customers");
}

/** For side panel list; call from client. */
export async function getCustomersListAction() {
  return getCustomersWithDetails();
}
