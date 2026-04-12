"use server";

import * as q from "./customersQueries";

export type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "./customersQueries";

export async function getCustomers() {
  return q.fetchCustomers();
}
