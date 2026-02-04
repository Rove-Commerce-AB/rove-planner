"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { updateConsultant, deleteConsultant } from "@/lib/consultants";
import type { ConsultantForEdit } from "@/lib/consultants";
import {
  ConfirmModal,
  Select,
  Button,
  DetailPageHeader,
  Panel,
} from "@/components/ui";
import { getRoles } from "@/lib/roles";
import { getCalendars } from "@/lib/calendars";
import { getTeams } from "@/lib/teams";

const WORK_PERCENTAGE_OPTIONS = Array.from(
  { length: 20 },
  (_, i) => (i + 1) * 5
);

const OVERHEAD_PERCENTAGE_OPTIONS = Array.from(
  { length: 21 },
  (_, i) => i * 5
); // 0, 5, ..., 100

const tableBorder = "border-panel";

type EditField =
  | "name"
  | "email"
  | "role"
  | "calendar"
  | "workPercentage"
  | "overheadPercentage"
  | "team"
  | null;

type Props = {
  consultant: ConsultantForEdit;
};

export function ConsultantDetailClient({ consultant: initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [roleId, setRoleId] = useState(initial.role_id);
  const [email, setEmail] = useState(initial.email ?? "");
  const [calendarId, setCalendarId] = useState(initial.calendar_id);
  const [teamId, setTeamId] = useState<string | null>(initial.team_id);
  const [workPercentage, setWorkPercentage] = useState(initial.workPercentage);
  const [overheadPercentage, setOverheadPercentage] = useState(initial.overheadPercentage);
  const [isExternal, setIsExternal] = useState(initial.isExternal);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [calendars, setCalendars] = useState<
    { id: string; name: string; hours_per_week: number }[]
  >([]);
  const [optionsReady, setOptionsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingField, setEditingField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState<string>("");

  const syncFromInitial = useCallback(() => {
    setName(initial.name);
    setRoleId(initial.role_id);
    setEmail(initial.email ?? "");
    setCalendarId(initial.calendar_id);
    setTeamId(initial.team_id);
    setWorkPercentage(initial.workPercentage);
    setOverheadPercentage(initial.overheadPercentage);
    setIsExternal(initial.isExternal);
  }, [initial]);

  useEffect(() => {
    syncFromInitial();
  }, [syncFromInitial]);

  useEffect(() => {
    setOptionsReady(false);
    Promise.all([getRoles(), getCalendars(), getTeams()])
      .then(([r, c, t]) => {
        setRoles(r);
        setCalendars(c);
        setTeams(t);
        setOptionsReady(true);
      })
      .catch(() => setOptionsReady(true));
  }, []);

  const saveField = async (field: EditField, value: string) => {
    if (field == null) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload: Parameters<typeof updateConsultant>[1] = { id: initial.id } as never;
      switch (field) {
        case "name":
          await updateConsultant(initial.id, { name: value.trim() });
          setName(value.trim());
          break;
        case "email":
          await updateConsultant(initial.id, { email: value.trim() || null });
          setEmail(value.trim());
          break;
        case "role":
          await updateConsultant(initial.id, { role_id: value });
          setRoleId(value);
          break;
        case "calendar":
          await updateConsultant(initial.id, { calendar_id: value });
          setCalendarId(value);
          break;
        case "workPercentage":
          await updateConsultant(initial.id, { work_percentage: parseInt(value, 10) });
          setWorkPercentage(parseInt(value, 10));
          break;
        case "overheadPercentage":
          await updateConsultant(initial.id, { overhead_percentage: parseInt(value, 10) });
          setOverheadPercentage(parseInt(value, 10));
          break;
        case "team":
          await updateConsultant(initial.id, { team_id: value || null });
          setTeamId(value || null);
          break;
        default:
          break;
      }
      router.refresh();
      setEditingField(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setError(null);
  };

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await deleteConsultant(initial.id);
      setShowDeleteConfirm(false);
      router.push("/consultants");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const toggleExternal = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await updateConsultant(initial.id, { is_external: !isExternal });
      setIsExternal(!isExternal);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  const initials = initial.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleOptions = (() => {
    const base = roles.map((r) => ({ value: r.id, label: r.name }));
    if (roleId && initial.roleName && !base.some((o) => o.value === roleId)) {
      return [{ value: roleId, label: initial.roleName }, ...base];
    }
    return base;
  })();

  const calendarOptions = (() => {
    const base = calendars.map((c) => ({
      value: c.id,
      label: `${c.name} (${c.hours_per_week}h/week)`,
    }));
    if (
      calendarId &&
      initial.calendarName &&
      !base.some((o) => o.value === calendarId)
    ) {
      return [{ value: calendarId, label: initial.calendarName }, ...base];
    }
    return base;
  })();

  const teamOptions = [
    { value: "", label: "No team" },
    ...(teamId && initial.teamName && !teams.some((t) => t.id === teamId)
      ? [{ value: teamId, label: initial.teamName }]
      : []),
    ...teams.map((t) => ({ value: t.id, label: t.name })),
  ];

  const labelClass = "text-xs font-medium uppercase tracking-wider text-text-primary opacity-70";
  const valueClass = "font-semibold text-text-primary";

  return (
    <>
      <DetailPageHeader
        backHref="/consultants"
        backLabel="Back to Consultants"
        avatar={<span>{initials}</span>}
        title={name}
        subtitle={isExternal ? "External Consultant" : "Internal Consultant"}
        action={
          <Button
            variant="secondary"
            className="border-danger text-danger hover:bg-danger/10"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={submitting || deleting}
          >
            Delete Consultant
          </Button>
        }
      />

      {error && (
        <p className="mb-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* INFORMATION */}
        <Panel>
          <h2 className={`border-b ${tableBorder} bg-bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70`}>
            INFORMATION
          </h2>
          <div className="space-y-6 p-5">
            <div>
              <div className={labelClass}>Name</div>
              {editingField === "name" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 min-w-[120px] rounded-lg border-2 border-brand-signal px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("name", editValue)}
                    disabled={submitting || !editValue.trim()}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`mt-1.5 block text-left ${valueClass} hover:underline`}
                  onClick={() => {
                    setEditValue(name);
                    setEditingField("name");
                  }}
                >
                  {name}
                </button>
              )}
            </div>

            <div>
              <div className={labelClass}>Email</div>
              {editingField === "email" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input
                    type="email"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 min-w-[120px] rounded-lg border-2 border-brand-signal px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("email", editValue)}
                    disabled={submitting}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`mt-1.5 block text-left ${valueClass} hover:underline ${email ? "text-brand-signal" : "text-text-primary opacity-70"}`}
                  onClick={() => {
                    setEditValue(email);
                    setEditingField("email");
                  }}
                >
                  {email || "—"}
                </button>
              )}
            </div>

            <div>
              <div className={labelClass}>Default role</div>
              {editingField === "role" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Select
                    value={editValue}
                    onValueChange={setEditValue}
                    options={roleOptions}
                    placeholder="Select role"
                    className="min-w-[160px]"
                    triggerClassName="!border-2 !border-brand-signal"
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("role", editValue)}
                    disabled={submitting || !editValue}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`mt-1.5 block text-left ${valueClass} hover:underline`}
                  onClick={() => {
                    setEditValue(roleId);
                    setEditingField("role");
                  }}
                >
                  {initial.roleName}
                </button>
              )}
            </div>
          </div>
        </Panel>

        {/* TEAM & AVAILABILITY */}
        <Panel>
          <h2 className={`border-b ${tableBorder} bg-bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70`}>
            TEAM &amp; AVAILABILITY
          </h2>
          <div className="space-y-6 p-5">
            <div>
              <div className={labelClass}>Team</div>
              {editingField === "team" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Select
                    value={editValue}
                    onValueChange={setEditValue}
                    options={teamOptions}
                    placeholder="No team"
                    className="min-w-[160px]"
                    triggerClassName="!border-2 !border-brand-signal"
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("team", editValue)}
                    disabled={submitting}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`mt-1.5 block text-left ${valueClass} hover:underline`}
                  onClick={() => {
                    setEditValue(teamId ?? "");
                    setEditingField("team");
                  }}
                >
                  {initial.teamName ?? "—"}
                </button>
              )}
            </div>

            <div>
              <div className={labelClass}>Capacity</div>
              {editingField === "workPercentage" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Select
                    value={editValue}
                    onValueChange={setEditValue}
                    options={WORK_PERCENTAGE_OPTIONS.map((p) => ({
                      value: String(p),
                      label: `${p}%`,
                    }))}
                    placeholder="Select"
                    className="min-w-[100px]"
                    triggerClassName="!border-2 !border-brand-signal"
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("workPercentage", editValue)}
                    disabled={submitting || !editValue}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`mt-1.5 block text-left ${valueClass} hover:underline`}
                  onClick={() => {
                    setEditValue(String(workPercentage));
                    setEditingField("workPercentage");
                  }}
                >
                  {workPercentage}%
                </button>
              )}
            </div>

            <div>
              <div className={labelClass}>Overhead (%)</div>
              {editingField === "overheadPercentage" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Select
                    value={editValue}
                    onValueChange={setEditValue}
                    options={OVERHEAD_PERCENTAGE_OPTIONS.map((p) => ({
                      value: String(p),
                      label: `${p}%`,
                    }))}
                    placeholder="Select"
                    className="min-w-[100px]"
                    triggerClassName="!border-2 !border-brand-signal"
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("overheadPercentage", editValue)}
                    disabled={submitting || editValue === ""}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`mt-1.5 block text-left ${valueClass} hover:underline`}
                  onClick={() => {
                    setEditValue(String(overheadPercentage ?? 0));
                    setEditingField("overheadPercentage");
                  }}
                >
                  {overheadPercentage ?? 0}%
                </button>
              )}
            </div>

            <div>
              <div className={labelClass}>Calendar</div>
              {editingField === "calendar" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Select
                    value={editValue}
                    onValueChange={setEditValue}
                    options={calendarOptions}
                    placeholder="Select calendar"
                    className="min-w-[180px]"
                    triggerClassName="!border-2 !border-brand-signal"
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("calendar", editValue)}
                    disabled={submitting || !editValue}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`mt-1.5 block text-left ${valueClass} hover:underline`}
                  onClick={() => {
                    setEditValue(calendarId);
                    setEditingField("calendar");
                  }}
                >
                  {initial.calendarName}
                </button>
              )}
            </div>
          </div>
        </Panel>

        {/* ADDITIONAL INFORMATION + TYPE */}
        <Panel className="lg:col-span-2">
          <h2 className={`border-b ${tableBorder} bg-bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70`}>
            ADDITIONAL INFORMATION
          </h2>
          <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className={labelClass}>Internal ID</div>
              <p className={`mt-1.5 ${valueClass}`}>{initial.id.slice(0, 8)}…</p>
            </div>
            <div>
              <div className={labelClass}>Type</div>
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={toggleExternal}
                  disabled={submitting}
                  className="inline-flex rounded-full border border-[var(--color-brand-blue)] bg-brand-blue/50 px-3 py-1 text-xs font-medium text-text-primary hover:bg-brand-blue/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  {isExternal ? "External" : "Internal"}
                </button>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete consultant"
        message={`Delete ${name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
