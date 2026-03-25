import type { SupabaseClient } from "@supabase/supabase-js";

export type Team = {
  id: string;
  name: string;
};

export async function fetchTeams(supabase: SupabaseClient): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("id,name")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function createTeamQuery(
  supabase: SupabaseClient,
  name: string
): Promise<Team> {
  const { data, error } = await supabase
    .from("teams")
    .insert({ name: name.trim() })
    .select("id,name")
    .single();

  if (error) throw error;
  return data;
}

export async function updateTeamQuery(
  supabase: SupabaseClient,
  id: string,
  name: string
): Promise<Team> {
  const { data, error } = await supabase
    .from("teams")
    .update({ name: name.trim() })
    .eq("id", id)
    .select("id,name")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTeamQuery(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("teams").delete().eq("id", id);

  if (error) throw error;
}
