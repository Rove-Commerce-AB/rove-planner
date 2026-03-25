import { createClient } from "@/lib/supabase/client";
import * as q from "./rolesQueries";

export type { Role } from "./rolesQueries";

export async function getRoles() {
  const supabase = createClient();
  return q.fetchRoles(supabase);
}

export async function createRole(name: string) {
  const supabase = createClient();
  return q.createRoleQuery(supabase, name);
}

export async function updateRole(id: string, name: string) {
  const supabase = createClient();
  return q.updateRoleQuery(supabase, id, name);
}

export async function deleteRole(id: string) {
  const supabase = createClient();
  return q.deleteRoleQuery(supabase, id);
}
