import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import { cloudSqlPool } from "@/lib/cloudSqlPool";

const UNREAD_COUNT_REVALIDATE = 45;
const PM_NAV_REVALIDATE = 300;

async function fetchUnreadNotificationCountByEmail(
  email: string
): Promise<number> {
  try {
    const { rows } = await cloudSqlPool.query<{ n: string }>(
      `SELECT count(*)::text AS n
       FROM user_notifications un
       INNER JOIN app_users au ON au.id = un.app_user_id
       WHERE lower(trim(au.email)) = lower(trim($1))
         AND un.read_at IS NULL`,
      [email]
    );
    return Number(rows[0]?.n ?? 0);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err?.code === "42501" || err?.code === "42P01") return 0;
    const msg = typeof err?.message === "string" ? err.message : "";
    if (
      msg.includes("permission denied for table user_notifications") ||
      msg.includes('relation "user_notifications" does not exist')
    ) {
      return 0;
    }
    throw e;
  }
}

export async function getCachedUnreadNotificationCount(
  email: string
): Promise<number> {
  return unstable_cache(
    () => fetchUnreadNotificationCountByEmail(email),
    ["layout-unread-notifications", email.trim().toLowerCase()],
    {
      revalidate: UNREAD_COUNT_REVALIDATE,
      tags: [`user-notifications-${email.trim().toLowerCase()}`],
    }
  )();
}

async function fetchConsultantHasManagedProject(
  consultantId: string
): Promise<boolean> {
  const { rows } = await cloudSqlPool.query<{ id: string }>(
    `SELECT id FROM projects WHERE project_manager_id = $1 LIMIT 1`,
    [consultantId]
  );
  return rows.length > 0;
}

export async function getCachedProjectManagerNavVisible(
  consultantId: string
): Promise<boolean> {
  return unstable_cache(
    () => fetchConsultantHasManagedProject(consultantId),
    ["layout-pm-nav", consultantId],
    {
      revalidate: PM_NAV_REVALIDATE,
      tags: [`project-manager-nav-${consultantId}`],
    }
  )();
}

export function revalidateUserNotificationCache(email: string) {
  revalidateTag(`user-notifications-${email.trim().toLowerCase()}`, "max");
}

export function revalidateProjectManagerNavCache(consultantId: string) {
  revalidateTag(`project-manager-nav-${consultantId}`, "max");
}
