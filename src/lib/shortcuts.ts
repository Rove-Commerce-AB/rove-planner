"use server";

import { revalidateTag, unstable_cache } from "next/cache";
import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { getCurrentAppUser } from "@/lib/appUsers";
import {
  normalizeShortcutHref,
  shortcutMatchKey,
} from "@/lib/shortcutHref";

export type AppUserShortcut = {
  id: string;
  name: string;
  href: string;
  created_at: string;
};

const SHORTCUTS_REVALIDATE = 60;

function shortcutsCacheTag(appUserId: string) {
  return `user-shortcuts-${appUserId}`;
}

function isMissingTableError(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  if (err?.code === "42501" || err?.code === "42P01") return true;
  const msg = typeof err?.message === "string" ? err.message : "";
  return (
    msg.includes('relation "app_user_shortcuts" does not exist') ||
    msg.includes("permission denied for table app_user_shortcuts")
  );
}

async function fetchShortcutsForUser(
  appUserId: string
): Promise<AppUserShortcut[]> {
  try {
    const { rows } = await cloudSqlPool.query<AppUserShortcut>(
      `SELECT id, name, href, created_at::text
       FROM app_user_shortcuts
       WHERE app_user_id = $1
       ORDER BY created_at ASC, name ASC`,
      [appUserId]
    );
    return rows;
  } catch (e) {
    if (isMissingTableError(e)) return [];
    throw e;
  }
}

export async function listShortcutsForCurrentUser(): Promise<AppUserShortcut[]> {
  const user = await getCurrentAppUser();
  if (!user) return [];

  return unstable_cache(
    () => fetchShortcutsForUser(user.id),
    ["user-shortcuts", user.id],
    {
      revalidate: SHORTCUTS_REVALIDATE,
      tags: [shortcutsCacheTag(user.id)],
    }
  )();
}

export async function createShortcut(args: {
  name: string;
  href: string;
}): Promise<AppUserShortcut[]> {
  const user = await getCurrentAppUser();
  if (!user) throw new Error("Unauthorized");

  const name = args.name.trim();
  if (!name) throw new Error("Name is required");
  if (name.length > 80) throw new Error("Name is too long");

  const href = normalizeShortcutHref(args.href);
  if (!href.startsWith("/")) throw new Error("Invalid href");

  try {
    await cloudSqlPool.query(
      `INSERT INTO app_user_shortcuts (app_user_id, name, href)
       VALUES ($1, $2, $3)`,
      [user.id, name, href]
    );
    revalidateTag(shortcutsCacheTag(user.id), "max");
    return fetchShortcutsForUser(user.id);
  } catch (e) {
    if (isMissingTableError(e)) {
      throw new Error(
        "Shortcuts are not available yet. Run scripts/20260920_app_user_shortcuts.sql."
      );
    }
    throw e;
  }
}

export async function deleteShortcutsMatchingHref(
  href: string
): Promise<AppUserShortcut[]> {
  const user = await getCurrentAppUser();
  if (!user) throw new Error("Unauthorized");

  const matchKey = shortcutMatchKey(href);

  try {
    const { rows } = await cloudSqlPool.query<{ id: string; href: string }>(
      `SELECT id, href FROM app_user_shortcuts WHERE app_user_id = $1`,
      [user.id]
    );
    const ids = rows
      .filter((row) => shortcutMatchKey(row.href) === matchKey)
      .map((row) => row.id);

    if (ids.length > 0) {
      await cloudSqlPool.query(
        `DELETE FROM app_user_shortcuts
         WHERE app_user_id = $1 AND id = ANY($2::uuid[])`,
        [user.id, ids]
      );
      revalidateTag(shortcutsCacheTag(user.id), "max");
    }
    return fetchShortcutsForUser(user.id);
  } catch (e) {
    if (isMissingTableError(e)) return [];
    throw e;
  }
}
