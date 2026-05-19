import { AppLayoutClient } from "@/components/AppLayoutClient";
import { getCurrentAppUser } from "@/lib/appUsers";
import { getConsultantForCurrentUser } from "@/lib/consultants";
import {
  getCachedProjectManagerNavVisible,
  getCachedUnreadNotificationCount,
} from "@/lib/layoutShell";

/** Auth and app_users gatekeeping run in src/proxy.ts. */

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentAppUser();
  const isAdmin = user?.role === "admin";
  const isSubcontractor = user?.role === "subcontractor";
  let canSeeTimeReportProjectManager = false;

  if (isAdmin || isSubcontractor) {
    canSeeTimeReportProjectManager = true;
  } else {
    try {
      const consultant = await getConsultantForCurrentUser();
      if (consultant?.id) {
        canSeeTimeReportProjectManager =
          await getCachedProjectManagerNavVisible(consultant.id);
      }
    } catch {
      // If the new column isn't present yet (or DB is in-flight), fail closed.
      canSeeTimeReportProjectManager = false;
    }
  }

  const unreadNotificationCount =
    user?.email != null
      ? await getCachedUnreadNotificationCount(user.email)
      : 0;

  return (
    <AppLayoutClient
      isAdmin={isAdmin}
      canSeeTimeReportProjectManager={canSeeTimeReportProjectManager}
      isSubcontractor={isSubcontractor}
      unreadNotificationCount={unreadNotificationCount}
    >
      {children}
    </AppLayoutClient>
  );
}
