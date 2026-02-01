"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Globe, Pencil, Trash2, Plus, UsersRound } from "lucide-react";
import { getRoles, deleteRole } from "@/lib/roles";
import { getTeams, deleteTeam } from "@/lib/teams";
import { getCalendarsWithHolidayCount } from "@/lib/calendars";
import { Button, ConfirmModal, PageHeader } from "@/components/ui";
import { AddRoleModal } from "./AddRoleModal";
import { EditRoleModal } from "./EditRoleModal";
import { AddTeamModal } from "./AddTeamModal";
import { EditTeamModal } from "./EditTeamModal";
import { AddCalendarModal } from "./AddCalendarModal";
import { CalendarAccordionItem } from "./CalendarAccordionItem";

type Props = {
  roles: Awaited<ReturnType<typeof getRoles>>;
  teams: Awaited<ReturnType<typeof getTeams>>;
  calendars: Awaited<ReturnType<typeof getCalendarsWithHolidayCount>>;
  error: string | null;
};

export function SettingsPageClient({
  roles: initialRoles,
  teams: initialTeams,
  calendars: initialCalendars,
  error,
}: Props) {
  const router = useRouter();
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [addCalendarOpen, setAddCalendarOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleRoleDelete = async () => {
    if (!roleToDelete) return;
    try {
      await deleteRole(roleToDelete.id);
      setRoleToDelete(null);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete role");
    }
  };

  const handleTeamDelete = async () => {
    if (!teamToDelete) return;
    try {
      await deleteTeam(teamToDelete.id);
      setTeamToDelete(null);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete team");
    }
  };

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage calendars, roles and system configuration"
      />

      {error && (
        <p className="mt-6 text-sm text-danger">Error: {error}</p>
      )}

      <section className="mt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <Users className="h-5 w-5" />
              Roles
            </h2>
            <p className="mt-1 text-sm text-text-primary opacity-70">
              Manage roles that can be assigned to allocations. Also used for
              customer-specific hourly rates.
            </p>
          </div>
          <Button onClick={() => setAddRoleOpen(true)} className="self-start">
            <Plus className="h-4 w-4" />
            Add role
          </Button>
        </div>

        <ul className="mt-4 space-y-2">
          {initialRoles.map((role) => (
            <li
              key={role.id}
              className="flex items-center justify-between rounded-lg border border-border bg-bg-default px-4 py-3"
            >
              <span className="font-medium text-text-primary">{role.name}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingRole(role)}
                  className="rounded-md p-1.5 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100"
                  aria-label={`Edit ${role.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRoleToDelete(role)}
                  className="rounded-md p-1.5 text-text-primary opacity-60 hover:bg-danger/10 hover:text-danger"
                  aria-label={`Delete ${role.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <UsersRound className="h-5 w-5" />
              Teams
            </h2>
            <p className="mt-1 text-sm text-text-primary opacity-70">
              Manage teams for grouping consultants. Used for filtering on the
              Allocation page.
            </p>
          </div>
          <Button onClick={() => setAddTeamOpen(true)} className="self-start">
            <Plus className="h-4 w-4" />
            Add team
          </Button>
        </div>

        <ul className="mt-4 space-y-2">
          {initialTeams.map((team) => (
            <li
              key={team.id}
              className="flex items-center justify-between rounded-lg border border-border bg-bg-default px-4 py-3"
            >
              <span className="font-medium text-text-primary">{team.name}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingTeam(team)}
                  className="rounded-md p-1.5 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100"
                  aria-label={`Edit ${team.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTeamToDelete(team)}
                  className="rounded-md p-1.5 text-text-primary opacity-60 hover:bg-danger/10 hover:text-danger"
                  aria-label={`Delete ${team.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <Globe className="h-5 w-5" />
              Calendars
            </h2>
            <p className="mt-1 text-sm text-text-primary opacity-70">
              Manage calendars with holidays for different countries. Consultants
              are linked to a calendar to determine their working hours and days
              off.
            </p>
          </div>
          <Button onClick={() => setAddCalendarOpen(true)} className="self-start">
            <Plus className="h-4 w-4" />
            Add calendar
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {initialCalendars.map((calendar) => (
            <CalendarAccordionItem
              key={calendar.id}
              calendar={calendar}
              onDelete={handleSuccess}
              onUpdate={handleSuccess}
            />
          ))}
        </div>
      </section>

      <AddRoleModal
        isOpen={addRoleOpen}
        onClose={() => setAddRoleOpen(false)}
        onSuccess={handleSuccess}
      />

      <EditRoleModal
        role={editingRole}
        isOpen={editingRole !== null}
        onClose={() => setEditingRole(null)}
        onSuccess={handleSuccess}
      />

      <ConfirmModal
        isOpen={roleToDelete !== null}
        title="Delete role"
        message="Delete this role? Consultants using it may be affected."
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setRoleToDelete(null)}
        onConfirm={handleRoleDelete}
      />

      <AddTeamModal
        isOpen={addTeamOpen}
        onClose={() => setAddTeamOpen(false)}
        onSuccess={handleSuccess}
      />

      <EditTeamModal
        team={editingTeam}
        isOpen={editingTeam !== null}
        onClose={() => setEditingTeam(null)}
        onSuccess={handleSuccess}
      />

      <ConfirmModal
        isOpen={teamToDelete !== null}
        title="Delete team"
        message="Delete this team? Consultants using it may be affected."
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setTeamToDelete(null)}
        onConfirm={handleTeamDelete}
      />

      <AddCalendarModal
        isOpen={addCalendarOpen}
        onClose={() => setAddCalendarOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
