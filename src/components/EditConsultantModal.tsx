"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { updateConsultant, deleteConsultant } from "@/lib/consultants";
import { useEscToClose } from "@/lib/useEscToClose";
import { ConfirmModal, Select, Switch } from "@/components/ui";
import { getRoles } from "@/lib/roles";
import { getCalendars } from "@/lib/calendars";
import { getTeams } from "@/lib/teams";
import type { ConsultantWithDetails } from "@/types";

const WORK_PERCENTAGE_OPTIONS = Array.from(
  { length: 20 },
  (_, i) => (i + 1) * 5
); // 5, 10, ..., 100

const OVERHEAD_PERCENTAGE_OPTIONS = Array.from(
  { length: 21 },
  (_, i) => i * 5
); // 0, 5, 10, ..., 100

type Props = {
  consultant: ConsultantWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function EditConsultantModal({
  consultant,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [email, setEmail] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [workPercentage, setWorkPercentage] = useState(100);
  const [overheadPercentage, setOverheadPercentage] = useState(0);
  const [isExternal, setIsExternal] = useState(false);
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

  useEffect(() => {
    if (isOpen && consultant) {
      setName(consultant.name);
      setEmail(consultant.email ?? "");
      setWorkPercentage(consultant.workPercentage ?? 100);
      setOverheadPercentage(consultant.overheadPercentage ?? 0);
      setIsExternal(consultant.isExternal ?? false);
      setOptionsReady(false);
      Promise.all([getRoles(), getCalendars(), getTeams()])
        .then(([r, c, t]) => {
          setRoles(r);
          setCalendars(c);
          setTeams(t);
          setRoleId(consultant.role_id ?? "");
          setCalendarId(consultant.calendar_id ?? "");
          setTeamId(consultant.team_id ?? null);
          setOptionsReady(true);
        })
        .catch(() => {
          setRoles([]);
          setCalendars([]);
          setTeams([]);
          setRoleId(consultant.role_id ?? "");
          setCalendarId(consultant.calendar_id ?? "");
          setTeamId(consultant.team_id ?? null);
          setOptionsReady(true);
        });
    }
  }, [isOpen, consultant]);

  const handleSubmit = async () => {
    if (!consultant) return;
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!roleId) {
      setError("Default role is required");
      return;
    }
    if (!calendarId) {
      setError("Calendar is required");
      return;
    }
    setSubmitting(true);
    try {
      await updateConsultant(consultant.id, {
        name: name.trim(),
        email: email.trim() || null,
        role_id: roleId,
        calendar_id: calendarId,
        team_id: teamId ?? null,
        work_percentage: workPercentage,
        overhead_percentage: overheadPercentage,
        is_external: isExternal,
      });
      resetForm();
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update consultant");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!consultant) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteConsultant(consultant.id);
      setShowDeleteConfirm(false);
      resetForm();
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete consultant");
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setRoleId("");
    setEmail("");
    setCalendarId("");
    setTeamId(null);
    setWorkPercentage(100);
    setOverheadPercentage(0);
    setIsExternal(false);
    setOptionsReady(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  useEscToClose(isOpen, handleClose);

  if (!isOpen || !consultant) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-lg bg-bg-default p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-consultant-title"
      >
        <div className="flex items-center justify-between">
          <h2
            id="edit-consultant-title"
            className="text-lg font-semibold text-text-primary"
          >
            Edit consultant
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-sm p-1 text-text-primary opacity-60 hover:bg-bg-muted hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          id="edit-consultant-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="mt-6 space-y-4"
        >
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div>
            <label
              htmlFor="edit-consultant-name"
              className="block text-sm font-medium text-text-primary"
            >
              Name
            </label>
            <input
              id="edit-consultant-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Anna Andersson"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
            />
          </div>

          <Select
            key={`role-${optionsReady}-${roleId}`}
            id="edit-consultant-role"
            label="Default role"
            value={roleId}
            onValueChange={setRoleId}
            placeholder="Select role"
            options={(() => {
              const base = roles.map((r) => ({ value: r.id, label: r.name }));
              if (roleId && consultant.roleName && !base.some((o) => o.value === roleId)) {
                return [{ value: roleId, label: consultant.roleName }, ...base];
              }
              return base;
            })()}
          />

          <div>
            <label
              htmlFor="edit-consultant-email"
              className="block text-sm font-medium text-text-primary"
            >
              Email
            </label>
            <input
              id="edit-consultant-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="anna@company.com"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
            />
          </div>

          <Select
            key={`calendar-${optionsReady}-${calendarId}`}
            id="edit-consultant-calendar"
            label="Calendar"
            value={calendarId}
            onValueChange={setCalendarId}
            placeholder="Select calendar"
            options={(() => {
              const base = calendars.map((c) => ({
                value: c.id,
                label: `${c.name} (${c.hours_per_week}h/week)`,
              }));
              if (calendarId && consultant.calendarName && !base.some((o) => o.value === calendarId)) {
                return [{ value: calendarId, label: consultant.calendarName }, ...base];
              }
              return base;
            })()}
          />

          <Select
            id="edit-consultant-work-percentage"
            label="Capacity (%)"
            value={String(workPercentage)}
            onValueChange={(v) => setWorkPercentage(parseInt(v, 10))}
            placeholder="Select"
            options={WORK_PERCENTAGE_OPTIONS.map((p) => ({
              value: String(p),
              label: `${p}%`,
            }))}
          />

          <Select
            id="edit-consultant-overhead"
            label="Overhead (%)"
            value={String(overheadPercentage)}
            onValueChange={(v) => setOverheadPercentage(parseInt(v, 10))}
            placeholder="Select"
            options={OVERHEAD_PERCENTAGE_OPTIONS.map((p) => ({
              value: String(p),
              label: `${p}%`,
            }))}
          />

          <Select
            id="edit-consultant-team"
            label="Team (optional)"
            value={teamId ?? ""}
            onValueChange={(v) => setTeamId(v ? v : null)}
            placeholder="No team"
            options={[
              { value: "", label: "No team" },
              ...(teamId && consultant.teamName && !teams.some((t) => t.id === teamId)
                ? [{ value: teamId, label: consultant.teamName }]
                : []),
              ...teams.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />

          <Switch
            id="edit-consultant-external"
            checked={isExternal}
            onCheckedChange={setIsExternal}
            label="External consultant"
          />
        </form>

        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={submitting || deleting}
            className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-border bg-bg-default px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-consultant-form"
              disabled={submitting || deleting}
              className="rounded-lg bg-brand-signal px-4 py-2 text-sm font-medium text-text-inverse hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete consultant"
        message={`Delete ${consultant?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
