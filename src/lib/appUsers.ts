"use server";

import { auth } from "@/auth";
import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { revalidatePath } from "next/cache";

export type AppUser = {
  id: string;
  email: string;
  role: AppUserRole;
  name: string | null;
  created_at: string;
};

export type AppUserRole = "admin" | "member" | "subcontractor";

export type CurrentAppUser = {
  email: string;
  role: AppUserRole;
  name: string | null;
} | null;

export async function getCurrentAppUser(): Promise<CurrentAppUser> {
  const session = await auth();
  if (!session?.user?.email) return null;

  return {
    email: session.user.email,
    role: session.user.role as AppUserRole,
    name: session.user.name ?? null,
  };
}

export async function getAppUsersForAdmin(): Promise<AppUser[]> {
  const current = await getCurrentAppUser();
  if (!current || current.role !== "admin") return [];

  const { rows } = await cloudSqlPool.query<AppUser>(
    "SELECT id, email, role, name, created_at FROM app_users ORDER BY email"
  );
  return rows;
}

export async function addAppUser(formData: FormData) {
  const current = await getCurrentAppUser();
  if (!current || current.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const name = (formData.get("name") as string)?.trim() || null;
  const role = ((formData.get("role") as string) || "member") as AppUserRole;

  if (!email) throw new Error("Email is required");
  if (role !== "admin" && role !== "member" && role !== "subcontractor") {
    throw new Error("Invalid role");
  }

  await cloudSqlPool.query(
    "INSERT INTO app_users (email, name, role) VALUES ($1, $2, $3)",
    [email, name, role]
  );

  revalidatePath("/settings");
}

export async function removeAppUser(id: string) {
  const current = await getCurrentAppUser();
  if (!current || current.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await cloudSqlPool.query("DELETE FROM app_users WHERE id = $1", [id]);

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

  const setParts: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (args.email !== undefined) {
    const email = args.email.trim().toLowerCase();
    if (!email) throw new Error("Email is required");
    setParts.push(`email = $${idx++}`);
    values.push(email);
  }

  if (args.name !== undefined) {
    const name = (args.name ?? "").trim();
    setParts.push(`name = $${idx++}`);
    values.push(name === "" ? null : name);
  }

  if (args.role !== undefined) {
    if (args.role !== "admin" && args.role !== "member" && args.role !== "subcontractor") {
      throw new Error("Invalid role");
    }
    setParts.push(`role = $${idx++}`);
    values.push(args.role);
  }

  if (setParts.length === 0) return;

  setParts.push(`updated_at = now()`);
  values.push(args.id);

  await cloudSqlPool.query(
    `UPDATE app_users SET ${setParts.join(", ")} WHERE id = $${idx}`,
    values
  );

  revalidatePath("/settings");
}