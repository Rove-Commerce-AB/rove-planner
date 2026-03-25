import "server-only";

import { createClient } from "@/lib/supabase/server";
import * as q from "./teamsQueries";

export type { Team } from "./teamsQueries";

export async function getTeams() {
  const supabase = await createClient();
  return q.fetchTeams(supabase);
}

export async function createTeam(name: string) {
  const supabase = await createClient();
  return q.createTeamQuery(supabase, name);
}

export async function updateTeam(id: string, name: string) {
  const supabase = await createClient();
  return q.updateTeamQuery(supabase, id, name);
}

export async function deleteTeam(id: string) {
  const supabase = await createClient();
  return q.deleteTeamQuery(supabase, id);
}
