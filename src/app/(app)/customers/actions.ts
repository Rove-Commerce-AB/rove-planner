"use server";

import { revalidatePath } from "next/cache";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/lib/customers";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@/lib/customers";
import type { Customer } from "@/lib/customers";

export async function revalidateCustomers() {
  revalidatePath("/customers");
}

export async function createCustomerAction(
  input: CreateCustomerInput
): Promise<Customer> {
  const customer = await createCustomer(input);
  revalidatePath("/customers");
  return customer;
}

export async function updateCustomerAction(
  id: string,
  input: UpdateCustomerInput
): Promise<Customer> {
  const customer = await updateCustomer(id, input);
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return customer;
}

export async function deleteCustomerAction(id: string): Promise<void> {
  await deleteCustomer(id);
  revalidatePath("/customers");
}
