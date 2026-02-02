"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateConsultant, deleteConsultant } from "@/lib/consultants";
import type { ConsultantForEdit } from "@/lib/consultants";
import {
  ConfirmModal,
  Select,
  Switch,
  Button,
  DetailPageHeader,
  Panel,
  PanelSection,
} from "@/components/ui";
import { User } from "lucide-react";
import { getRoles } from "@/lib/roles";
import { getCalendars } from "@/lib/calendars";
import { getTeams } from "@/lib/teams";

const WORK_PERCENTAGE_OPTIONS = Array.from(
  { length: 20 },
  (_, i) => (i + 1) * 5
);

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
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setName(initial.name);
    setRoleId(initial.role_id);
    setEmail(initial.email ?? "");
    setCalendarId(initial.calendar_id);
    setTeamId(initial.team_id);
    setWorkPercentage(initial.workPercentage);
    setIsExternal(initial.isExternal);
  }, [initial]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
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
      await updateConsultant(initial.id, {
        name: name.trim(),
        email: email.trim() || null,
        role_id: roleId,
        calendar_id: calendarId,
        team_id: teamId ?? null,
        work_percentage: workPercentage,
        is_external: isExternal,
      });
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
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

  return (
    <>
      <DetailPageHeader
        backHref="/consultants"
        backLabel="Back to consultants"
        avatar={<span>{initials}</span>}
        title={initial.name}
        subtitle="Consultant"
        action={
          <Button
            variant="danger"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={submitting || deleting}
          >
            Delete
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-2xl">
        {error && (
          <p className="mb-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="mb-4 text-sm text-success" role="status">
            Saved
          </p>
        )}

        <Panel>
          <PanelSection
            title="Information"
            icon={<User className="h-5 w-5 text-text-primary opacity-70" />}
            footer={
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </Button>
            }
          >
            <div className="space-y-4">
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
                />
              </div>

              <Select
                key={`role-${optionsReady}-${roleId}`}
                id="consultant-role"
                label="Default role"
                value={roleId}
                onValueChange={setRoleId}
                placeholder="Select role"
                options={roleOptions}
              />

              <div>
                <label
                  htmlFor="consultant-email"
                  className="block text-sm font-medium text-text-primary"
                >
                  Email
                </label>
                <input
                  id="consultant-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="anna@company.com"
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
                />
              </div>

              <Select
                key={`calendar-${optionsReady}-${calendarId}`}
                id="consultant-calendar"
                label="Calendar"
                value={calendarId}
                onValueChange={setCalendarId}
                placeholder="Select calendar"
                options={calendarOptions}
              />

              <Select
                id="consultant-work-percentage"
                label="Work percentage"
                value={String(workPercentage)}
                onValueChange={(v) => setWorkPercentage(parseInt(v, 10))}
                placeholder="Select"
                options={WORK_PERCENTAGE_OPTIONS.map((p) => ({
                  value: String(p),
                  label: `${p}%`,
                }))}
              />

              <Select
                id="consultant-team"
                label="Team (optional)"
                value={teamId ?? ""}
                onValueChange={(v) => setTeamId(v ? v : null)}
                placeholder="No team"
                options={[
                  { value: "", label: "No team" },
                  ...(teamId &&
                  initial.teamName &&
                  !teams.some((t) => t.id === teamId)
                    ? [{ value: teamId, label: initial.teamName }]
                    : []),
                  ...teams.map((t) => ({ value: t.id, label: t.name })),
                ]}
              />

              <Switch
                id="consultant-external"
                checked={isExternal}
                onCheckedChange={setIsExternal}
                label="External consultant"
              />
            </div>
          </PanelSection>
        </Panel>
      </form>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete consultant"
        message={`Delete ${initial.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
