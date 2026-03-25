import { AppLayoutClient } from "@/components/AppLayoutClient";
import { getCurrentAppUser } from "@/lib/appUsers";
import { getConsultantForCurrentUser } from "@/lib/consultants";
import { createClient } from "@/lib/supabase/server";

/** Auth and app_users gatekeeping run in src/proxy.ts (Supabase session + redirects). */

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentAppUser();
  const isAdmin = user?.role === "admin";
  let canSeeTimeReportProjectManager = false;
  try {
    if (!isAdmin) {
      const consultant = await getConsultantForCurrentUser();
      if (consultant?.id) {
        const supabase = await createClient();
        const { data } = await supabase
          .from("projects")
          .select("id")
          .eq("project_manager_id", consultant.id)
          .limit(1);
        canSeeTimeReportProjectManager = (data?.length ?? 0) > 0;
      }
    } else {
      canSeeTimeReportProjectManager = true;
    }
  } catch {
    // If the new column isn't present yet (or DB is in-flight), fail closed.
    canSeeTimeReportProjectManager = false;
  }

  return (
    <AppLayoutClient
      isAdmin={isAdmin}
      canSeeTimeReportProjectManager={canSeeTimeReportProjectManager}
    >
      {children}
    </AppLayoutClient>
  );
}
