import { getRoles } from "@/lib/roles";
import { getTeams } from "@/lib/teams";
import { getCalendarsWithHolidayCount } from "@/lib/calendars";
import { getCurrentAppUser, getAppUsersForAdmin } from "@/lib/appUsers";
import { SettingsPageClient } from "@/components/SettingsPageClient";

export default async function SettingsPage() {
  let roles: Awaited<ReturnType<typeof getRoles>> = [];
  let teams: Awaited<ReturnType<typeof getTeams>> = [];
  let calendars: Awaited<ReturnType<typeof getCalendarsWithHolidayCount>> = [];
  let appUsers: Awaited<ReturnType<typeof getAppUsersForAdmin>> = [];
  let currentAppUser: Awaited<ReturnType<typeof getCurrentAppUser>> = null;
  let error: string | null = null;

  try {
    [roles, teams, calendars, currentAppUser, appUsers] = await Promise.all([
      getRoles(),
      getTeams(),
      getCalendarsWithHolidayCount(),
      getCurrentAppUser(),
      getAppUsersForAdmin(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load settings";
  }

  return (
    <div className="p-6">
      <SettingsPageClient
        roles={roles}
        teams={teams}
        calendars={calendars}
        appUsers={appUsers}
        currentAppUser={currentAppUser}
        error={error}
      />
    </div>
  );
}
