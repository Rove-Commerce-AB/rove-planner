import { getRoles } from "@/lib/roles";
import { getTeams } from "@/lib/teams";
import { getCalendarsWithHolidayCount } from "@/lib/calendars";
import { SettingsPageClient } from "@/components/SettingsPageClient";

export default async function SettingsPage() {
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
    <div className="p-6">
      <SettingsPageClient
        roles={roles}
        teams={teams}
        calendars={calendars}
        error={error}
      />
    </div>
  );
}
