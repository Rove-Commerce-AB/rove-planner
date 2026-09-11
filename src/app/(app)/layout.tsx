import { Sidebar } from "@/components/Sidebar";
import { AppTopBar } from "@/components/AppTopBar";
import { FeatureRequestFab } from "@/components/FeatureRequestFab";
import { AppThemeAttr } from "@/components/AppThemeAttr";
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
    <div className="flex h-full overflow-hidden">
      <AppThemeAttr />
      <Sidebar
        isAdmin={isAdmin}
        canSeeTimeReportProjectManager={canSeeTimeReportProjectManager}
        isSubcontractor={isSubcontractor}
        isCustomerUser={user?.role === "customer"}
        appKeys={user?.appKeys ?? []}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppTopBar unreadNotificationCount={unreadNotificationCount} />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-surface-page p-(--space-32)">
          {children}
        </main>
      </div>
      <FeatureRequestFab />
    </div>
  );
}
