import { createClient } from "@/lib/supabase/client";
import * as q from "./customersQueries";

export type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "./customersQueries";

export async function getCustomers() {
  const supabase = createClient();
  return q.fetchCustomers(supabase);
}
