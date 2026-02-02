"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Globe, Trash2, Plus, UsersRound } from "lucide-react";
import { getRoles, deleteRole, updateRole } from "@/lib/roles";
import { getTeams, deleteTeam, updateTeam } from "@/lib/teams";
import { getCalendarsWithHolidayCount } from "@/lib/calendars";
import { Button, ConfirmModal, PageHeader, Panel } from "@/components/ui";

const panelHeaderBorder = "border-panel";
import { AddRoleModal } from "./AddRoleModal";
import { AddTeamModal } from "./AddTeamModal";
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
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleValue, setEditingRoleValue] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const [addCalendarOpen, setAddCalendarOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamValue, setEditingTeamValue] = useState("");
  const [savingTeam, setSavingTeam] = useState(false);
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

  const saveRoleInline = async () => {
    if (!editingRoleId || !editingRoleValue.trim()) return;
    setSavingRole(true);
    try {
      await updateRole(editingRoleId, editingRoleValue.trim());
      setEditingRoleId(null);
      setEditingRoleValue("");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setSavingRole(false);
    }
  };

  const saveTeamInline = async () => {
    if (!editingTeamId || !editingTeamValue.trim()) return;
    setSavingTeam(true);
    try {
      await updateTeam(editingTeamId, editingTeamValue.trim());
      setEditingTeamId(null);
      setEditingTeamValue("");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update team");
    } finally {
      setSavingTeam(false);
    }
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

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <div
            className={`flex items-center justify-between gap-2 border-b ${panelHeaderBorder} bg-bg-muted/40 px-4 py-3`}
          >
            <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70">
              <Users className="h-4 w-4" />
              Roles
            </h2>
            <Button onClick={() => setAddRoleOpen(true)}>
              <Plus className="h-4 w-4" />
              Add role
            </Button>
          </div>
          <div className="space-y-4 p-5">
            <p className="text-sm text-text-primary opacity-70">
              Manage roles that can be assigned to allocations. Also used for
              customer-specific hourly rates.
            </p>
            <ul className="space-y-3">
              {initialRoles.map((role) => (
                <li
                  key={role.id}
                  className="flex items-center gap-3 rounded-lg border border-panel bg-bg-default px-3 py-2"
                >
                  {editingRoleId === role.id ? (
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={editingRoleValue}
                        onChange={(e) => setEditingRoleValue(e.target.value)}
                        className="min-w-[120px] flex-1 rounded-lg border-2 border-brand-signal px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRoleInline();
                          if (e.key === "Escape") {
                            setEditingRoleId(null);
                            setEditingRoleValue("");
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={saveRoleInline}
                        disabled={savingRole || !editingRoleValue.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => {
                          setEditingRoleId(null);
                          setEditingRoleValue("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRoleId(role.id);
                        setEditingRoleValue(role.name);
                      }}
                      className="flex-1 text-left text-sm font-medium text-text-primary hover:underline"
                    >
                      {role.name}
                    </button>
                  )}
                  {editingRoleId !== role.id && (
                    <button
                      type="button"
                      onClick={() => setRoleToDelete(role)}
                      className="rounded-sm p-1.5 text-text-primary opacity-60 hover:bg-danger/10 hover:text-danger"
                      aria-label={`Delete ${role.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel>
          <div
            className={`flex items-center justify-between gap-2 border-b ${panelHeaderBorder} bg-bg-muted/40 px-4 py-3`}
          >
            <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70">
              <UsersRound className="h-4 w-4" />
              Teams
            </h2>
            <Button onClick={() => setAddTeamOpen(true)}>
              <Plus className="h-4 w-4" />
              Add team
            </Button>
          </div>
          <div className="space-y-4 p-5">
            <p className="text-sm text-text-primary opacity-70">
              Manage teams for grouping consultants. Used for filtering on the
              Allocation page.
            </p>
            <ul className="space-y-3">
              {initialTeams.map((team) => (
                <li
                  key={team.id}
                  className="flex items-center gap-3 rounded-lg border border-panel bg-bg-default px-3 py-2"
                >
                  {editingTeamId === team.id ? (
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={editingTeamValue}
                        onChange={(e) => setEditingTeamValue(e.target.value)}
                        className="min-w-[120px] flex-1 rounded-lg border-2 border-brand-signal px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveTeamInline();
                          if (e.key === "Escape") {
                            setEditingTeamId(null);
                            setEditingTeamValue("");
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={saveTeamInline}
                        disabled={savingTeam || !editingTeamValue.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => {
                          setEditingTeamId(null);
                          setEditingTeamValue("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTeamId(team.id);
                        setEditingTeamValue(team.name);
                      }}
                      className="flex-1 text-left text-sm font-medium text-text-primary hover:underline"
                    >
                      {team.name}
                    </button>
                  )}
                  {editingTeamId !== team.id && (
                    <button
                      type="button"
                      onClick={() => setTeamToDelete(team)}
                      className="rounded-sm p-1.5 text-text-primary opacity-60 hover:bg-danger/10 hover:text-danger"
                      aria-label={`Delete ${team.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel>
          <div
            className={`flex items-center justify-between gap-2 border-b ${panelHeaderBorder} bg-bg-muted/40 px-4 py-3`}
          >
            <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70">
              <Globe className="h-4 w-4" />
              Calendars
            </h2>
            <Button onClick={() => setAddCalendarOpen(true)}>
              <Plus className="h-4 w-4" />
              Add calendar
            </Button>
          </div>
          <div className="space-y-4 p-5">
            <p className="text-sm text-text-primary opacity-70">
              Manage calendars with holidays for different countries. Consultants
              are linked to a calendar to determine their working hours and days
              off.
            </p>
            <div className="space-y-3">
              {initialCalendars.map((calendar) => (
                <CalendarAccordionItem
                  key={calendar.id}
                  calendar={calendar}
                  onDelete={handleSuccess}
                  onUpdate={handleSuccess}
                />
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <AddRoleModal
        isOpen={addRoleOpen}
        onClose={() => setAddRoleOpen(false)}
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
