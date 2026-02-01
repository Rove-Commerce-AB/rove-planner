"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Select, Switch } from "@/components/ui";
import { createConsultant } from "@/lib/consultants";
import { getRoles } from "@/lib/roles";
import { getTeams } from "@/lib/teams";
import { useEscToClose } from "@/lib/useEscToClose";
import { getCalendars } from "@/lib/calendars";

const WORK_PERCENTAGE_OPTIONS = Array.from(
  { length: 20 },
  (_, i) => (i + 1) * 5
); // 5, 10, ..., 100

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddConsultantModal({ isOpen, onClose, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [email, setEmail] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [workPercentage, setWorkPercentage] = useState(100);
  const [isExternal, setIsExternal] = useState(false);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [calendars, setCalendars] = useState<
    { id: string; name: string; hours_per_week: number }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      Promise.all([getRoles(), getCalendars(), getTeams()])
        .then(([r, c, t]) => {
          setRoles(r);
          setCalendars(c);
          setTeams(t);
          setRoleId((prev) => (prev || r[0]?.id) ?? "");
          setCalendarId((prev) => (prev || c[0]?.id) ?? "");
        })
        .catch(() => {
          setRoles([]);
          setCalendars([]);
          setTeams([]);
        });
    }
  }, [isOpen]);

  const handleSubmit = async () => {
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
      await createConsultant({
        name: name.trim(),
        email: email.trim() || null,
        role_id: roleId,
        calendar_id: calendarId,
        team_id: teamId || null,
        work_percentage: workPercentage,
        is_external: isExternal,
      });
      resetForm();
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add consultant");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setRoleId("");
    setEmail("");
    setCalendarId("");
    setTeamId(null);
    setIsExternal(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  useEscToClose(isOpen, handleClose);

  if (!isOpen) return null;

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
        aria-labelledby="add-consultant-title"
      >
        <div className="flex items-center justify-between">
          <h2
            id="add-consultant-title"
            className="text-lg font-semibold text-text-primary"
          >
            Add new consultant
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-text-primary opacity-60 hover:bg-bg-muted hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
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
              htmlFor="consultant-name"
              className="block text-sm font-medium text-text-primary"
            >
              Name
            </label>
            <input
              id="consultant-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Anna Andersson"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
              autoFocus
            />
          </div>

          <Select
            id="consultant-role"
            label="Default role"
            value={roleId}
            onValueChange={setRoleId}
            placeholder="Select role"
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
          />

          <Select
            id="consultant-calendar"
            label="Calendar"
            value={calendarId}
            onValueChange={setCalendarId}
            placeholder="Select calendar"
            options={calendars.map((c) => ({
              value: c.id,
              label: `${c.name} (${c.hours_per_week}h/week)`,
            }))}
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-border bg-bg-default px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-signal px-4 py-2 text-sm font-medium text-text-inverse hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
