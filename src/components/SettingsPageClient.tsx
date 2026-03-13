"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, Check } from "lucide-react";
import { getRoles, deleteRole, updateRole } from "@/lib/roles";
import { getTeams, deleteTeam, updateTeam } from "@/lib/teams";
import { getCalendarsWithHolidayCount } from "@/lib/calendars";
import { removeAppUser, type AppUser } from "@/lib/appUsers";
import {
  updateFeatureRequest,
  deleteFeatureRequest,
  setFeatureRequestImplemented,
  type FeatureRequest,
} from "@/lib/featureRequests";
import { IconButton, ConfirmModal, InlineEditStatus, SavedCheckmark, PageHeader, Panel, PanelSectionTitle, SAVED_DURATION_MS, INLINE_EDIT_STATUS_ROW_MIN_H, editInputListClass, inlineEditTriggerListClass, inlineEditTriggerListClassRowHover } from "@/components/ui";
import { isInlineEditValueChanged } from "@/lib/inlineEdit";

import { AddAppUserModal } from "./AddAppUserModal";
import { AddRoleModal } from "./AddRoleModal";
import { AddTeamModal } from "./AddTeamModal";
import { AddCalendarModal } from "./AddCalendarModal";
import { CalendarAccordionItem } from "./CalendarAccordionItem";

type CurrentAppUser = { email: string; role: string; name: string | null } | null;

type Props = {
  roles: Awaited<ReturnType<typeof getRoles>>;
  teams: Awaited<ReturnType<typeof getTeams>>;
  calendars: Awaited<ReturnType<typeof getCalendarsWithHolidayCount>>;
  appUsers: AppUser[];
  currentAppUser: CurrentAppUser;
  featureRequests: FeatureRequest[];
  error: string | null;
};

export function SettingsPageClient({
  roles: initialRoles,
  teams: initialTeams,
  calendars: initialCalendars,
  appUsers: initialAppUsers,
  currentAppUser,
  featureRequests: initialFeatureRequests,
  error,
}: Props) {
  const router = useRouter();
  const isAdmin = currentAppUser?.role === "admin";
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [appUserToDelete, setAppUserToDelete] = useState<AppUser | null>(null);
  const [addAppUserModalOpen, setAddAppUserModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleValue, setEditingRoleValue] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const [showSavedRole, setShowSavedRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const savedRoleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRoleIdRef = useRef<string | null>(null);
  const [addCalendarOpen, setAddCalendarOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamValue, setEditingTeamValue] = useState("");
  const [savingTeam, setSavingTeam] = useState(false);
  const [showSavedTeam, setShowSavedTeam] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const savedTeamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTeamIdRef = useRef<string | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editingFeatureRequestId, setEditingFeatureRequestId] = useState<string | null>(null);
  const [editingFeatureRequestValue, setEditingFeatureRequestValue] = useState("");
  const [savingFeatureRequest, setSavingFeatureRequest] = useState(false);
  const [showSavedFeatureRequest, setShowSavedFeatureRequest] = useState(false);
  const [featureRequestError, setFeatureRequestError] = useState<string | null>(null);
  const savedFeatureRequestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedFeatureRequestIdRef = useRef<string | null>(null);
  const [featureRequestToDelete, setFeatureRequestToDelete] = useState<FeatureRequest | null>(null);
  const [togglingImplementedId, setTogglingImplementedId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (savedRoleTimeoutRef.current) clearTimeout(savedRoleTimeoutRef.current);
      if (savedTeamTimeoutRef.current) clearTimeout(savedTeamTimeoutRef.current);
      if (savedFeatureRequestTimeoutRef.current) clearTimeout(savedFeatureRequestTimeoutRef.current);
    };
  }, []);

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

  const handleAppUserDelete = async () => {
    if (!appUserToDelete) return;
    try {
      await removeAppUser(appUserToDelete.id);
      setAppUserToDelete(null);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not remove user");
    }
  };

  const saveFeatureRequestInline = async (originalContent: string) => {
    if (!editingFeatureRequestId) return;
    if (!editingFeatureRequestValue.trim()) {
      setEditingFeatureRequestId(null);
      setEditingFeatureRequestValue("");
      return;
    }
    if (!isInlineEditValueChanged(originalContent, editingFeatureRequestValue)) {
      setEditingFeatureRequestId(null);
      setEditingFeatureRequestValue("");
      return;
    }
    setFeatureRequestError(null);
    const frIdToSave = editingFeatureRequestId;
    const valueToSave = editingFeatureRequestValue.trim();
    lastSavedFeatureRequestIdRef.current = frIdToSave;
    setEditingFeatureRequestId(null);
    setEditingFeatureRequestValue("");
    setShowSavedFeatureRequest(true);
    if (savedFeatureRequestTimeoutRef.current) clearTimeout(savedFeatureRequestTimeoutRef.current);
    savedFeatureRequestTimeoutRef.current = setTimeout(() => {
      savedFeatureRequestTimeoutRef.current = null;
      lastSavedFeatureRequestIdRef.current = null;
      setShowSavedFeatureRequest(false);
    }, SAVED_DURATION_MS);
    setSavingFeatureRequest(true);
    try {
      await updateFeatureRequest(frIdToSave, valueToSave);
      router.refresh();
    } catch (e) {
      setFeatureRequestError(e instanceof Error ? e.message : "Failed to update");
      setShowSavedFeatureRequest(false);
      lastSavedFeatureRequestIdRef.current = null;
    } finally {
      setSavingFeatureRequest(false);
    }
  };

  const cancelFeatureRequestEdit = (restoreContent: string) => {
    setEditingFeatureRequestValue(restoreContent);
    setEditingFeatureRequestId(null);
    setFeatureRequestError(null);
  };

  const handleFeatureRequestDelete = async () => {
    if (!featureRequestToDelete) return;
    try {
      await deleteFeatureRequest(featureRequestToDelete.id);
      setFeatureRequestToDelete(null);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const handleToggleImplemented = async (fr: FeatureRequest) => {
    setTogglingImplementedId(fr.id);
    try {
      await setFeatureRequestImplemented(fr.id, !fr.is_implemented);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setTogglingImplementedId(null);
    }
  };

  const saveRoleInline = async (originalName: string) => {
    if (!editingRoleId) return;
    if (!editingRoleValue.trim()) {
      setEditingRoleId(null);
      setEditingRoleValue("");
      return;
    }
    if (!isInlineEditValueChanged(originalName, editingRoleValue)) {
      setEditingRoleId(null);
      setEditingRoleValue("");
      return;
    }
    setRoleError(null);
    const roleIdToSave = editingRoleId;
    const valueToSave = editingRoleValue.trim();
    lastSavedRoleIdRef.current = roleIdToSave;
    setEditingRoleId(null);
    setEditingRoleValue("");
    setShowSavedRole(true);
    if (savedRoleTimeoutRef.current) clearTimeout(savedRoleTimeoutRef.current);
    savedRoleTimeoutRef.current = setTimeout(() => {
      savedRoleTimeoutRef.current = null;
      lastSavedRoleIdRef.current = null;
      setShowSavedRole(false);
    }, SAVED_DURATION_MS);
    setSavingRole(true);
    try {
      await updateRole(roleIdToSave, valueToSave);
      router.refresh();
    } catch (e) {
      setRoleError(e instanceof Error ? e.message : "Failed to update role");
      setShowSavedRole(false);
      lastSavedRoleIdRef.current = null;
    } finally {
      setSavingRole(false);
    }
  };

  const cancelRoleEdit = (restoreName: string) => {
    setEditingRoleValue(restoreName);
    setEditingRoleId(null);
    setRoleError(null);
  };

  const saveTeamInline = async (originalName: string) => {
    if (!editingTeamId) return;
    if (!editingTeamValue.trim()) {
      setEditingTeamId(null);
      setEditingTeamValue("");
      return;
    }
    if (!isInlineEditValueChanged(originalName, editingTeamValue)) {
      setEditingTeamId(null);
      setEditingTeamValue("");
      return;
    }
    setTeamError(null);
    const teamIdToSave = editingTeamId;
    const valueToSave = editingTeamValue.trim();
    lastSavedTeamIdRef.current = teamIdToSave;
    setEditingTeamId(null);
    setEditingTeamValue("");
    setShowSavedTeam(true);
    if (savedTeamTimeoutRef.current) clearTimeout(savedTeamTimeoutRef.current);
    savedTeamTimeoutRef.current = setTimeout(() => {
      savedTeamTimeoutRef.current = null;
      lastSavedTeamIdRef.current = null;
      setShowSavedTeam(false);
    }, SAVED_DURATION_MS);
    setSavingTeam(true);
    try {
      await updateTeam(teamIdToSave, valueToSave);
      router.refresh();
    } catch (e) {
      setTeamError(e instanceof Error ? e.message : "Failed to update team");
      setShowSavedTeam(false);
      lastSavedTeamIdRef.current = null;
    } finally {
      setSavingTeam(false);
    }
  };

  const cancelTeamEdit = (restoreName: string) => {
    setEditingTeamValue(restoreName);
    setEditingTeamId(null);
    setTeamError(null);
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage calendars, roles and system configuration"
        className="mb-6"
      />

      {error && (
        <p className="mb-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-5">
        {isAdmin && (
          <Panel>
            <PanelSectionTitle
              action={
                <IconButton
                  aria-label="Add user"
                  onClick={() => setAddAppUserModalOpen(true)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <Plus className="h-4 w-4" />
                </IconButton>
              }
            >
              ACCESS / USERS
            </PanelSectionTitle>
            <div className="overflow-x-auto p-3 pt-0">
              <ul className="space-y-0.5">
                {initialAppUsers.map((u) => (
                  <li
                    key={u.id}
                    className="flex h-[2.25rem] items-center gap-4 rounded-md px-2 transition-colors hover:bg-bg-muted/50"
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <span className="text-sm font-medium text-text-primary">{u.email}</span>
                      {u.name && (
                        <span className="ml-2 text-sm text-text-primary opacity-70">
                          ({u.name})
                        </span>
                      )}
                      <span className="ml-2 text-xs text-text-primary opacity-60">
                        {u.role === "admin" ? "Admin" : "Member"}
                      </span>
                    </div>
                    <IconButton
                      variant="ghostDanger"
                      onClick={() => setAppUserToDelete(u)}
                      aria-label={`Remove ${u.email}`}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        )}

        <Panel>
          <PanelSectionTitle
            action={
              <IconButton
                aria-label="Add role"
                onClick={() => setAddRoleOpen(true)}
                className="text-text-muted hover:text-text-primary"
              >
                <Plus className="h-4 w-4" />
              </IconButton>
            }
          >
            ROLES
          </PanelSectionTitle>
          <div className="overflow-x-auto p-3 pt-0">
            <ul className="space-y-0.5">
              {initialRoles.map((role) => (
                <li
                  key={role.id}
                  className={`flex items-center gap-4 rounded-md px-2 transition-colors hover:bg-bg-muted/50 ${editingRoleId === role.id ? "py-1" : "h-[2.25rem]"}`}
                >
                  <div className="min-w-0 flex-1 flex flex-col">
                    <div className="min-h-[2rem] flex items-center gap-2">
                      {editingRoleId === role.id ? (
                        <input
                          type="text"
                          value={editingRoleValue}
                          onChange={(e) => setEditingRoleValue(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => saveRoleInline(role.name)}
                          className={editInputListClass}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRoleInline(role.name);
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelRoleEdit(role.name);
                            }
                          }}
                        />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setRoleError(null);
                              setEditingRoleId(role.id);
                              setEditingRoleValue(role.name);
                            }}
                            className={inlineEditTriggerListClassRowHover}
                          >
                            {role.name}
                          </button>
                          {showSavedRole && lastSavedRoleIdRef.current === role.id && <SavedCheckmark />}
                        </>
                      )}
                    </div>
                    {editingRoleId === role.id && (
                      <div className={`shrink-0 ${INLINE_EDIT_STATUS_ROW_MIN_H}`}>
                        <InlineEditStatus
                          status={
                            savingRole ? "saving" : showSavedRole ? "saved" : roleError ? "error" : "idle"
                          }
                          message={roleError}
                        />
                      </div>
                    )}
                  </div>
                  {editingRoleId !== role.id && (
                    <IconButton
                      variant="ghostDanger"
                      onClick={() => setRoleToDelete(role)}
                      aria-label={`Delete ${role.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel>
          <PanelSectionTitle
            action={
              <IconButton
                aria-label="Add team"
                onClick={() => setAddTeamOpen(true)}
                className="text-text-muted hover:text-text-primary"
              >
                <Plus className="h-4 w-4" />
              </IconButton>
            }
          >
            TEAMS
          </PanelSectionTitle>
          <div className="overflow-x-auto p-3 pt-0">
            <ul className="space-y-0.5">
              {initialTeams.map((team) => (
                <li
                  key={team.id}
                  className={`flex items-center gap-4 rounded-md px-2 transition-colors hover:bg-bg-muted/50 ${editingTeamId === team.id ? "py-1" : "h-[2.25rem]"}`}
                >
                  <div className="min-w-0 flex-1 flex flex-col">
                    <div className="min-h-[2rem] flex items-center gap-2">
                      {editingTeamId === team.id ? (
                        <input
                          type="text"
                          value={editingTeamValue}
                          onChange={(e) => setEditingTeamValue(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => saveTeamInline(team.name)}
                          className={editInputListClass}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveTeamInline(team.name);
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelTeamEdit(team.name);
                            }
                          }}
                        />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setTeamError(null);
                              setEditingTeamId(team.id);
                              setEditingTeamValue(team.name);
                            }}
                            className={inlineEditTriggerListClassRowHover}
                          >
                            {team.name}
                          </button>
                          {showSavedTeam && lastSavedTeamIdRef.current === team.id && <SavedCheckmark />}
                        </>
                      )}
                    </div>
                    {editingTeamId === team.id && (
                      <div className={`shrink-0 ${INLINE_EDIT_STATUS_ROW_MIN_H}`}>
                        <InlineEditStatus
                          status={
                            savingTeam ? "saving" : showSavedTeam ? "saved" : teamError ? "error" : "idle"
                          }
                          message={teamError}
                        />
                      </div>
                    )}
                  </div>
                  {editingTeamId !== team.id && (
                    <IconButton
                      variant="ghostDanger"
                      onClick={() => setTeamToDelete(team)}
                      aria-label={`Delete ${team.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel>
          <PanelSectionTitle
            action={
              <IconButton
                aria-label="Add calendar"
                onClick={() => setAddCalendarOpen(true)}
                className="text-text-muted hover:text-text-primary"
              >
                <Plus className="h-4 w-4" />
              </IconButton>
            }
          >
            CALENDARS
          </PanelSectionTitle>
          <div className="overflow-x-auto p-3 pt-0">
            <div className="space-y-0.5">
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

        <Panel>
          <PanelSectionTitle>FEATURE REQUESTS</PanelSectionTitle>
          <div className="overflow-x-auto p-3 pt-0">
            <ul className="space-y-0.5">
              {initialFeatureRequests.length === 0 ? (
                <li className="rounded-md px-2 py-3 text-center text-sm text-text-primary opacity-60">
                  No feature requests yet.
                </li>
              ) : (
                initialFeatureRequests.map((fr) => (
                  <li
                    key={fr.id}
                    className={`flex items-start gap-4 rounded-md px-2 py-1.5 transition-colors hover:bg-bg-muted/50 ${fr.is_implemented ? "bg-green-100/80 dark:bg-green-900/20" : ""}`}
                  >
                    <div className="min-w-0 flex-1 flex flex-col">
                      <div className="flex min-h-[2rem] flex-col">
                        {editingFeatureRequestId === fr.id ? (
                          <textarea
                            value={editingFeatureRequestValue}
                            onChange={(e) => setEditingFeatureRequestValue(e.target.value)}
                            onBlur={() => saveFeatureRequestInline(fr.content)}
                            rows={2}
                            className={editInputListClass}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.preventDefault();
                                cancelFeatureRequestEdit(fr.content);
                              }
                            }}
                          />
                        ) : (
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-text-primary">
                                {fr.content}
                              </p>
                              {(fr.submitted_by_email || fr.created_at) && (
                                <p className="mt-1 text-xs text-text-primary opacity-60">
                                  Requested by{fr.submitted_by_email ? `: ${fr.submitted_by_email}` : ""}
                                  {fr.created_at && (
                                    <span>
                                      {fr.submitted_by_email ? " · " : ": "}
                                      {new Date(fr.created_at).toLocaleDateString(undefined, {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                            {showSavedFeatureRequest && lastSavedFeatureRequestIdRef.current === fr.id && <SavedCheckmark />}
                          </div>
                        )}
                      </div>
                      <div className={`shrink-0 ${INLINE_EDIT_STATUS_ROW_MIN_H}`}>
                        {editingFeatureRequestId === fr.id ? (
                          <InlineEditStatus
                            status={
                              savingFeatureRequest
                                ? "saving"
                                : showSavedFeatureRequest
                                  ? "saved"
                                  : featureRequestError
                                    ? "error"
                                    : "idle"
                            }
                            message={featureRequestError}
                          />
                        ) : (
                          <div className={INLINE_EDIT_STATUS_ROW_MIN_H} aria-hidden />
                        )}
                      </div>
                    </div>
                    {editingFeatureRequestId !== fr.id && (
                      <div className="flex flex-shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleImplemented(fr)}
                            disabled={togglingImplementedId === fr.id}
                            className={`cursor-pointer rounded-sm p-1.5 transition-colors disabled:opacity-50 ${fr.is_implemented ? "text-green-600 opacity-100" : "text-text-primary opacity-60 hover:opacity-100"} hover:bg-bg-muted/50`}
                            aria-label={fr.is_implemented ? "Mark as not implemented" : "Mark as implemented"}
                            title={fr.is_implemented ? "Mark as not implemented" : "Implemented"}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFeatureRequestError(null);
                              setEditingFeatureRequestId(fr.id);
                              setEditingFeatureRequestValue(fr.content);
                            }}
                            className="cursor-pointer rounded-sm p-1.5 text-text-primary opacity-60 transition-colors hover:bg-bg-muted/50 hover:opacity-100"
                            aria-label="Edit"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <IconButton
                            variant="ghostDanger"
                            onClick={() => setFeatureRequestToDelete(fr)}
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        </Panel>
      </div>

      <AddAppUserModal
        isOpen={addAppUserModalOpen}
        onClose={() => setAddAppUserModalOpen(false)}
        onSuccess={() => router.refresh()}
      />

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

      <ConfirmModal
        isOpen={appUserToDelete !== null}
        title="Remove user"
        message={
          appUserToDelete
            ? `Remove ${appUserToDelete.email} from the access list? They will no longer be able to log in.`
            : ""
        }
        confirmLabel="Remove"
        variant="primary"
        onClose={() => setAppUserToDelete(null)}
        onConfirm={handleAppUserDelete}
      />

      <ConfirmModal
        isOpen={featureRequestToDelete !== null}
        title="Delete feature request"
        message="Delete this feature request? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setFeatureRequestToDelete(null)}
        onConfirm={handleFeatureRequestDelete}
      />
    </>
  );
}
