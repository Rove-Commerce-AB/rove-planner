import { AppLayoutClient } from "@/components/AppLayoutClient";
import { getCurrentAppUser } from "@/lib/appUsers";
import { getConsultantForCurrentUser } from "@/lib/consultants";
import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { getUnreadNotificationCountForCurrentUser } from "@/lib/userNotifications";

/** Auth and app_users gatekeeping run in src/proxy.ts. */

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentAppUser();
  const isAdmin = user?.role === "admin";
  const isSubcontractor = user?.role === "subcontractor";
  let canSeeTimeReportProjectManager = false;
  try {
    if (!isAdmin && !isSubcontractor) {
      const consultant = await getConsultantForCurrentUser();
      if (consultant?.id) {
        const { rows } = await cloudSqlPool.query<{ id: string }>(
          `SELECT id FROM projects WHERE project_manager_id = $1 LIMIT 1`,
          [consultant.id]
        );
        canSeeTimeReportProjectManager = rows.length > 0;
      }
    } else {
      canSeeTimeReportProjectManager = true;
    }
  } catch {
    // If the new column isn't present yet (or DB is in-flight), fail closed.
    canSeeTimeReportProjectManager = false;
  }

  const dashboardUnreadNotificationCount = user
    ? await getUnreadNotificationCountForCurrentUser()
    : 0;

  return (
    <AppLayoutClient
      isAdmin={isAdmin}
      canSeeTimeReportProjectManager={canSeeTimeReportProjectManager}
      isSubcontractor={isSubcontractor}
      dashboardUnreadNotificationCount={dashboardUnreadNotificationCount}
    >
      {children}
    </AppLayoutClient>
  );
}
