import "server-only";

import { createClient } from "@/lib/supabase/server";
import * as q from "./customersQueries";

export type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "./customersQueries";

export async function getCustomerById(id: string) {
  const supabase = await createClient();
  return q.fetchCustomerById(supabase, id);
}

export async function getCustomers() {
  const supabase = await createClient();
  return q.fetchCustomers(supabase);
}

export async function getCustomerIdByName(name: string) {
  const supabase = await createClient();
  return q.fetchCustomerIdByName(supabase, name);
}

export async function getCustomersByIds(ids: string[]) {
  const supabase = await createClient();
  return q.fetchCustomersByIds(supabase, ids);
}

export async function createCustomer(input: q.CreateCustomerInput) {
  const supabase = await createClient();
  return q.createCustomerQuery(supabase, input);
}

export async function updateCustomer(id: string, input: q.UpdateCustomerInput) {
  const supabase = await createClient();
  return q.updateCustomerQuery(supabase, id, input);
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient();
  return q.deleteCustomerQuery(supabase, id);
}

export async function getCustomersWithDetails() {
  const supabase = await createClient();
  return q.fetchCustomersWithDetails(supabase);
}
