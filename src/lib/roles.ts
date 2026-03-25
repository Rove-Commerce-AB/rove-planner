import "server-only";

import { createClient } from "@/lib/supabase/server";
import * as q from "./rolesQueries";

export type { Role } from "./rolesQueries";

export async function getRoles() {
  const supabase = await createClient();
  return q.fetchRoles(supabase);
}

export async function createRole(name: string) {
  const supabase = await createClient();
  return q.createRoleQuery(supabase, name);
}

export async function updateRole(id: string, name: string) {
  const supabase = await createClient();
  return q.updateRoleQuery(supabase, id, name);
}

export async function deleteRole(id: string) {
  const supabase = await createClient();
  return q.deleteRoleQuery(supabase, id);
}
