"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type AppUser = {
  id: string;
  email: string;
  role: AppUserRole;
  name: string | null;
  created_at: string;
};

export type AppUserRole = "admin" | "member" | "subcontractor";
type DbAppUserRole = AppUserRole | "underkonsult";

export type CurrentAppUser = {
  email: string;
  role: AppUserRole;
  name: string | null;
} | null;

function normalizeRoleFromDb(role: string): AppUserRole {
  if (role === "underkonsult") return "subcontractor";
  if (role === "admin" || role === "member" || role === "subcontractor") return role;
  return "member";
}

function isRoleConstraintError(message: string | undefined): boolean {
  if (!message) return false;
  return message.includes("app_users_role_check");
}

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

  return row
    ? { email: row.email, role: normalizeRoleFromDb(row.role), name: row.name }
    : null;
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
  const rows = (data ?? []) as (AppUser & { role: DbAppUserRole })[];
  return rows.map((row) => ({ ...row, role: normalizeRoleFromDb(row.role) }));
}

export async function addAppUser(formData: FormData) {
  const current = await getCurrentAppUser();
  if (!current || current.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const email = (formData.get("email") as string)?.trim();
  const name = (formData.get("name") as string)?.trim() || null;
  const role = ((formData.get("role") as string) || "member") as AppUserRole;
  if (role !== "admin" && role !== "member" && role !== "subcontractor") {
    throw new Error("Invalid role");
  }


  if (!email) throw new Error("Email is required");

  const admin = createAdminClient();
  const { error } = await admin.from("app_users").insert({
    email: email.toLowerCase(),
    name: name || null,
    role,
  });

  if (error && role === "subcontractor" && isRoleConstraintError(error.message)) {
    const legacyInsert = await admin.from("app_users").insert({
      email: email.toLowerCase(),
      name: name || null,
      role: "underkonsult",
    });
    if (legacyInsert.error) throw new Error(legacyInsert.error.message);
  } else if (error) {
    throw new Error(error.message);
  }
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

export async function updateAppUser(args: {
  id: string;
  email?: string;
  name?: string | null;
  role?: AppUserRole;
}) {
  const current = await getCurrentAppUser();
  if (!current || current.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const updates: Record<string, unknown> = {};

  if (args.email !== undefined) {
    const email = args.email.trim().toLowerCase();
    if (!email) throw new Error("Email is required");
    updates.email = email;
  }

  if (args.name !== undefined) {
    const name = (args.name ?? "").trim();
    updates.name = name === "" ? null : name;
  }

  if (args.role !== undefined) {
    if (args.role !== "admin" && args.role !== "member" && args.role !== "subcontractor") {
      throw new Error("Invalid role");
    }
    updates.role = args.role;
  }

  if (Object.keys(updates).length === 0) return;

  const admin = createAdminClient();
  let errorResult = await admin.from("app_users").update(updates).eq("id", args.id);
  if (
    errorResult.error &&
    args.role === "subcontractor" &&
    isRoleConstraintError(errorResult.error.message)
  ) {
    const fallbackUpdates = { ...updates, role: "underkonsult" as const };
    errorResult = await admin.from("app_users").update(fallbackUpdates).eq("id", args.id);
  }
  const { error } = errorResult;
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
