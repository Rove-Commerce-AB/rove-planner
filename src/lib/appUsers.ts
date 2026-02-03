"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type AppUser = {
  id: string;
  email: string;
  role: string;
  name: string | null;
  created_at: string;
};

export type CurrentAppUser = {
  email: string;
  role: string;
  name: string | null;
} | null;

export async function getCurrentAppUser(): Promise<CurrentAppUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: row } = await supabase
    .from("app_users")
    .select("email, role, name")
    .eq("email", user.email)
    .maybeSingle();

  return row ? { email: row.email, role: row.role, name: row.name } : null;
}

export async function getAppUsersForAdmin(): Promise<AppUser[]> {
  const current = await getCurrentAppUser();
  if (!current || current.role !== "admin") return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, role, name, created_at")
    .order("email");

  if (error) return [];
  return (data ?? []) as AppUser[];
}

export async function addAppUser(formData: FormData) {
  const current = await getCurrentAppUser();
  if (!current || current.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const email = (formData.get("email") as string)?.trim();
  const name = (formData.get("name") as string)?.trim() || null;
  const role = ((formData.get("role") as string) || "member") as "admin" | "member";

  if (!email) throw new Error("E-post krävs");

  const admin = createAdminClient();
  const { error } = await admin.from("app_users").insert({
    email: email.toLowerCase(),
    name: name || null,
    role,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function removeAppUser(id: string) {
  const current = await getCurrentAppUser();
  if (!current || current.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("app_users").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
