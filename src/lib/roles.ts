import { supabase } from "./supabaseClient";

export type Role = {
  id: string;
  name: string;
};

export async function getRoles(): Promise<Role[]> {
  const { data, error } = await supabase
    .from("roles")
    .select("id,name")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function createRole(name: string): Promise<Role> {
  const { data, error } = await supabase
    .from("roles")
    .insert({ name: name.trim() })
    .select("id,name")
    .single();

  if (error) throw error;
  return data;
}

export async function updateRole(id: string, name: string): Promise<Role> {
  const { data, error } = await supabase
    .from("roles")
    .update({ name: name.trim() })
    .eq("id", id)
    .select("id,name")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRole(id: string): Promise<void> {
  const { error } = await supabase.from("roles").delete().eq("id", id);

  if (error) throw error;
}
