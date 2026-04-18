import { auth } from "@/auth";
import { PageHeader, Panel, PanelSectionTitle } from "@/components/ui";
import { DashboardNotificationsPanel } from "@/components/DashboardNotificationsPanel";
import { getNotificationsForCurrentUser } from "@/lib/userNotifications";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  const appUserId = session?.user?.appUserId;
  const notifications =
    appUserId != null ? await getNotificationsForCurrentUser(50) : [];

  return (
    <div className="p-6">
      <div className="mx-auto w-full max-w-2xl">
        <PageHeader title="Notifications" className="mb-6" />
        <Panel>
          <PanelSectionTitle>Recent</PanelSectionTitle>
          <div className="p-3 pt-0">
            <DashboardNotificationsPanel notifications={notifications} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
