import "server-only";

import * as q from "./rolesQueries";

export type { Role } from "./rolesQueries";

export async function getRoles() {
  return q.fetchRoles();
}

export async function createRole(name: string) {
  return q.createRoleQuery(name);
}

export async function updateRole(id: string, name: string) {
  return q.updateRoleQuery(id, name);
}

export async function deleteRole(id: string) {
  return q.deleteRoleQuery(id);
}
