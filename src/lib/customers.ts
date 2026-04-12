import "server-only";

import * as q from "./customersQueries";

export type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "./customersQueries";

export async function getCustomerById(id: string) {
  return q.fetchCustomerById(id);
}

export async function getCustomers() {
  return q.fetchCustomers();
}

export async function getCustomerIdByName(name: string) {
  return q.fetchCustomerIdByName(name);
}

export async function getCustomersByIds(ids: string[]) {
  return q.fetchCustomersByIds(ids);
}

export async function createCustomer(input: q.CreateCustomerInput) {
  return q.createCustomerQuery(input);
}

export async function updateCustomer(id: string, input: q.UpdateCustomerInput) {
  return q.updateCustomerQuery(id, input);
}

export async function deleteCustomer(id: string) {
  return q.deleteCustomerQuery(id);
}

export async function getCustomersWithDetails() {
  return q.fetchCustomersWithDetails();
}
