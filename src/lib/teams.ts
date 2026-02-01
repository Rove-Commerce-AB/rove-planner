import { supabase } from "./supabaseClient";

export type Team = {
  id: string;
  name: string;
};

export async function getTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("id,name")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function createTeam(name: string): Promise<Team> {
  const { data, error } = await supabase
    .from("teams")
    .insert({ name: name.trim() })
    .select("id,name")
    .single();

  if (error) throw error;
  return data;
}

export async function updateTeam(id: string, name: string): Promise<Team> {
  const { data, error } = await supabase
    .from("teams")
    .update({ name: name.trim() })
    .eq("id", id)
    .select("id,name")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase.from("teams").delete().eq("id", id);

  if (error) throw error;
}
