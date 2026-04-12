import "server-only";

import * as q from "./teamsQueries";

export type { Team } from "./teamsQueries";

export async function getTeams() {
  return q.fetchTeams();
}

export async function createTeam(name: string) {
  return q.createTeamQuery(name);
}

export async function updateTeam(id: string, name: string) {
  return q.updateTeamQuery(id, name);
}

export async function deleteTeam(id: string) {
  return q.deleteTeamQuery(id);
}
