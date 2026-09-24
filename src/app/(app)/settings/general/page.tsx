import { redirect } from "next/navigation";
import { getRoles } from "@/lib/roles";
import { getTeams } from "@/lib/teams";
import { getCalendarsWithHolidayCount } from "@/lib/calendars";
import { getCurrentAppUser } from "@/lib/appUsers";
import { SettingsPageClient } from "@/components/SettingsPageClient";
import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";

export default async function SettingsPage() {
  await redirectSubcontractorToAccessDenied();

  const user = await getCurrentAppUser();
  if (!user || user.role !== "admin") {
    redirect("/access-denied");
  }

  let roles: Awaited<ReturnType<typeof getRoles>> = [];
  let teams: Awaited<ReturnType<typeof getTeams>> = [];
  let calendars: Awaited<ReturnType<typeof getCalendarsWithHolidayCount>> = [];
  let error: string | null = null;

  try {
    [roles, teams, calendars] = await Promise.all([
      getRoles(),
      getTeams(),
      getCalendarsWithHolidayCount(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load settings";
  }

  return (
    <div>
      <div className="w-full max-w-3xl">
        <SettingsPageClient
          roles={roles}
          teams={teams}
          calendars={calendars}
          error={error}
        />
      </div>
    </div>
  );
}
