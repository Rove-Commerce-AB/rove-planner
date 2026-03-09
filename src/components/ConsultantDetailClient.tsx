"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateConsultant, deleteConsultant } from "@/lib/consultants";
import type { ConsultantForEdit } from "@/lib/consultants";
import {
  Button,
  ConfirmModal,
  DetailPageHeader,
  FieldLabel,
  FieldValue,
  InlineEditFieldContainer,
  InlineEditStatus,
  InlineEditTrigger,
  Panel,
  PanelSectionTitle,
  Select,
  SAVED_DURATION_MS,
  editInputClass,
  editTriggerClass,
} from "@/components/ui";
import { getRoles } from "@/lib/roles";
import { getCalendars } from "@/lib/calendars";
import { getTeams } from "@/lib/teams";
import { isInlineEditValueChanged } from "@/lib/inlineEdit";
import { useSidePanel } from "@/contexts/SidePanelContext";

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
  | "startDate"
  | "endDate"
  | null;

type Props = {
  consultant: ConsultantForEdit;
};

export function ConsultantDetailClient({ consultant: initial }: Props) {
  const router = useRouter();
  const { refreshConsultants } = useSidePanel();
  const [name, setName] = useState(initial.name);
  const [roleId, setRoleId] = useState(initial.role_id);
  const [email, setEmail] = useState(initial.email ?? "");
  const [calendarId, setCalendarId] = useState(initial.calendar_id);
  const [teamId, setTeamId] = useState<string | null>(initial.team_id);
  const [workPercentage, setWorkPercentage] = useState(initial.workPercentage);
  const [overheadPercentage, setOverheadPercentage] = useState(initial.overheadPercentage);
  const [startDate, setStartDate] = useState(initial.startDate ?? "");
  const [endDate, setEndDate] = useState(initial.endDate ?? "");
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
  const originalEditValueRef = useRef<string>("");
  const [showSaved, setShowSaved] = useState(false);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedFieldRef = useRef<EditField>(null);

  const syncFromInitial = useCallback(() => {
    setName(initial.name);
    setRoleId(initial.role_id);
    setEmail(initial.email ?? "");
    setCalendarId(initial.calendar_id);
    setTeamId(initial.team_id);
    setWorkPercentage(initial.workPercentage);
    setOverheadPercentage(initial.overheadPercentage);
    setStartDate(initial.startDate ?? "");
    setEndDate(initial.endDate ?? "");
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

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const saveField = async (field: EditField, value: string) => {
    if (field == null) return;
    setError(null);
    const trimmed = value.trim();
    switch (field) {
      case "name":
        setName(trimmed);
        break;
      case "email":
        setEmail(trimmed);
        break;
      case "role":
        setRoleId(value);
        break;
      case "calendar":
        setCalendarId(value);
        break;
      case "workPercentage":
        setWorkPercentage(parseInt(value, 10));
        break;
      case "overheadPercentage":
        setOverheadPercentage(parseInt(value, 10));
        break;
      case "team":
        setTeamId(value || null);
        break;
      case "startDate":
        setStartDate(trimmed);
        break;
      case "endDate":
        setEndDate(trimmed);
        break;
      default:
        break;
    }
    lastSavedFieldRef.current = field;
    setEditingField(null);
    setShowSaved(true);
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = setTimeout(() => {
      savedTimeoutRef.current = null;
      lastSavedFieldRef.current = null;
      setShowSaved(false);
    }, SAVED_DURATION_MS);
    setSubmitting(true);
    try {
      switch (field) {
        case "name":
          await updateConsultant(initial.id, { name: trimmed });
          break;
        case "email":
          await updateConsultant(initial.id, { email: trimmed || null });
          break;
        case "role":
          await updateConsultant(initial.id, { role_id: value });
          break;
        case "calendar":
          await updateConsultant(initial.id, { calendar_id: value });
          break;
        case "workPercentage":
          await updateConsultant(initial.id, { work_percentage: parseInt(value, 10) });
          break;
        case "overheadPercentage":
          await updateConsultant(initial.id, { overhead_percentage: parseInt(value, 10) });
          break;
        case "team":
          await updateConsultant(initial.id, { team_id: value || null });
          break;
        case "startDate":
          await updateConsultant(initial.id, { start_date: trimmed || null });
          break;
        case "endDate":
          await updateConsultant(initial.id, { end_date: trimmed || null });
          break;
        default:
          break;
      }
      refreshConsultants();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
      setShowSaved(false);
      lastSavedFieldRef.current = null;
      switch (field) {
        case "name": setName(initial.name); break;
        case "email": setEmail(initial.email ?? ""); break;
        case "role": setRoleId(initial.role_id); break;
        case "calendar": setCalendarId(initial.calendar_id); break;
        case "team": setTeamId(initial.team_id); break;
        case "workPercentage": setWorkPercentage(initial.workPercentage); break;
        case "overheadPercentage": setOverheadPercentage(initial.overheadPercentage); break;
        case "startDate": setStartDate(initial.startDate ?? ""); break;
        case "endDate": setEndDate(initial.endDate ?? ""); break;
        default: break;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (field: EditField, value: string) => {
    setError(null);
    originalEditValueRef.current = value;
    setEditValue(value);
    setEditingField(field);
  };

  const cancelEdit = () => {
    setEditValue(originalEditValueRef.current);
    setEditingField(null);
    setError(null);
  };

  const commitEdit = (overrideValue?: string) => {
    if (editingField == null) return;
    const val = overrideValue ?? editValue;
    if (!isInlineEditValueChanged(originalEditValueRef.current, val)) {
      setEditingField(null);
      return;
    }
    saveField(editingField, val);
  };

  const inlineEditStatus =
    submitting ? "saving" : showSaved ? "saved" : error ? "error" : "idle";

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await deleteConsultant(initial.id);
      setShowDeleteConfirm(false);
      router.push("/");
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
      refreshConsultants();
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

  return (
    <>
      <DetailPageHeader
        avatar={<span>{initials}</span>}
        title={name}
      />

      {error && (
        <p className="mb-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <Panel>
        <PanelSectionTitle>GENERAL INFORMATION</PanelSectionTitle>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 p-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0">
            <FieldLabel>Name</FieldLabel>
            <div className="mt-0.5">
              <InlineEditFieldContainer
                isEditing={editingField === "name"}
                onRequestClose={commitEdit}
                showSavedIndicator={showSaved && lastSavedFieldRef.current === "name"}
                displayContent={
                  <InlineEditTrigger onClick={() => startEdit("name", name)}>
                    <FieldValue>{name}</FieldValue>
                  </InlineEditTrigger>
                }
                editContent={
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEdit()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    className={editInputClass}
                    autoFocus
                  />
                }
                statusContent={<InlineEditStatus status={inlineEditStatus} message={error} />}
              />
            </div>
          </div>

          <div className="min-w-0">
            <FieldLabel>Email</FieldLabel>
            <div className="mt-0.5">
              <InlineEditFieldContainer
                isEditing={editingField === "email"}
                onRequestClose={commitEdit}
                showSavedIndicator={showSaved && lastSavedFieldRef.current === "email"}
                displayContent={
                  <InlineEditTrigger
                    className={email ? "text-brand-signal" : "text-text-primary opacity-70"}
                    onClick={() => startEdit("email", email)}
                  >
                    <FieldValue>{email || "—"}</FieldValue>
                  </InlineEditTrigger>
                }
                editContent={
                  <input
                    type="email"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEdit()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    className={editInputClass}
                    autoFocus
                  />
                }
                statusContent={<InlineEditStatus status={inlineEditStatus} message={error} />}
              />
            </div>
          </div>

          <div className="min-w-0">
            <FieldLabel>Default role</FieldLabel>
            <div className="mt-0.5">
              <InlineEditFieldContainer
                isEditing={editingField === "role"}
                onRequestClose={commitEdit}
                showSavedIndicator={showSaved && lastSavedFieldRef.current === "role"}
                displayContent={
                  <InlineEditTrigger onClick={() => startEdit("role", roleId)}>
                    <FieldValue>{initial.roleName}</FieldValue>
                  </InlineEditTrigger>
                }
                editContent={
                  <Select
                    value={editValue}
                    onValueChange={(v) => {
                      setEditValue(v);
                      commitEdit(v);
                    }}
                    onBlur={() => commitEdit()}
                    options={roleOptions}
                    placeholder="Select role"
                    className="min-w-0 flex-1 w-full"
                    triggerClassName={editTriggerClass}
                  />
                }
                statusContent={<InlineEditStatus status={inlineEditStatus} message={error} />}
              />
            </div>
          </div>

          <div className="min-w-0">
            <FieldLabel>Team</FieldLabel>
            <div className="mt-0.5">
              <InlineEditFieldContainer
                isEditing={editingField === "team"}
                onRequestClose={commitEdit}
                showSavedIndicator={showSaved && lastSavedFieldRef.current === "team"}
                displayContent={
                  <InlineEditTrigger onClick={() => startEdit("team", teamId ?? "")}>
                    <FieldValue>{initial.teamName ?? "—"}</FieldValue>
                  </InlineEditTrigger>
                }
                editContent={
                  <Select
                    value={editValue}
                    onValueChange={(v) => {
                      setEditValue(v);
                      commitEdit(v);
                    }}
                    onBlur={() => commitEdit()}
                    options={teamOptions}
                    placeholder="No team"
                    className="min-w-0 flex-1 w-full"
                    triggerClassName={editTriggerClass}
                  />
                }
                statusContent={<InlineEditStatus status={inlineEditStatus} message={error} />}
              />
            </div>
          </div>

          <div className="min-w-0">
            <FieldLabel>Capacity</FieldLabel>
            <div className="mt-0.5">
              <InlineEditFieldContainer
                isEditing={editingField === "workPercentage"}
                onRequestClose={commitEdit}
                showSavedIndicator={showSaved && lastSavedFieldRef.current === "workPercentage"}
                displayContent={
                  <InlineEditTrigger
                    onClick={() =>
                      startEdit("workPercentage", String(workPercentage))
                    }
                  >
                    <FieldValue>{workPercentage}%</FieldValue>
                  </InlineEditTrigger>
                }
                editContent={
                  <Select
                    value={editValue}
                    onValueChange={(v) => {
                      setEditValue(v);
                      commitEdit(v);
                    }}
                    onBlur={() => commitEdit()}
                    options={WORK_PERCENTAGE_OPTIONS.map((p) => ({
                      value: String(p),
                      label: `${p}%`,
                    }))}
                    placeholder="Select"
                    className="min-w-0 flex-1 w-full"
                    triggerClassName={editTriggerClass}
                  />
                }
                statusContent={<InlineEditStatus status={inlineEditStatus} message={error} />}
              />
            </div>
          </div>

          <div className="min-w-0">
            <FieldLabel>Overhead (%)</FieldLabel>
            <div className="mt-0.5">
              <InlineEditFieldContainer
                isEditing={editingField === "overheadPercentage"}
                onRequestClose={commitEdit}
                showSavedIndicator={showSaved && lastSavedFieldRef.current === "overheadPercentage"}
                displayContent={
                  <InlineEditTrigger
                    onClick={() =>
                      startEdit(
                        "overheadPercentage",
                        String(overheadPercentage ?? 0)
                      )
                    }
                  >
                    <FieldValue>{overheadPercentage ?? 0}%</FieldValue>
                  </InlineEditTrigger>
                }
                editContent={
                  <Select
                    value={editValue}
                    onValueChange={(v) => {
                      setEditValue(v);
                      commitEdit(v);
                    }}
                    onBlur={() => commitEdit()}
                    options={OVERHEAD_PERCENTAGE_OPTIONS.map((p) => ({
                      value: String(p),
                      label: `${p}%`,
                    }))}
                    placeholder="Select"
                    className="min-w-0 flex-1 w-full"
                    triggerClassName={editTriggerClass}
                  />
                }
                statusContent={<InlineEditStatus status={inlineEditStatus} message={error} />}
              />
            </div>
          </div>

          <div className="min-w-0">
            <FieldLabel>Start date</FieldLabel>
            <div className="mt-0.5">
              <InlineEditFieldContainer
                isEditing={editingField === "startDate"}
                onRequestClose={commitEdit}
                showSavedIndicator={showSaved && lastSavedFieldRef.current === "startDate"}
                displayContent={
                  <InlineEditTrigger
                    className={startDate ? "text-brand-signal" : "text-text-primary opacity-70"}
                    onClick={() => startEdit("startDate", startDate)}
                  >
                    <FieldValue>{startDate || "—"}</FieldValue>
                  </InlineEditTrigger>
                }
                editContent={
                  <input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEdit()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    className={editInputClass}
                    autoFocus
                  />
                }
                statusContent={<InlineEditStatus status={inlineEditStatus} message={error} />}
              />
            </div>
          </div>

          <div className="min-w-0">
            <FieldLabel>End date</FieldLabel>
            <div className="mt-0.5">
              <InlineEditFieldContainer
                isEditing={editingField === "endDate"}
                onRequestClose={commitEdit}
                showSavedIndicator={showSaved && lastSavedFieldRef.current === "endDate"}
                displayContent={
                  <InlineEditTrigger
                    className={endDate ? "text-brand-signal" : "text-text-primary opacity-70"}
                    onClick={() => startEdit("endDate", endDate)}
                  >
                    <FieldValue>{endDate || "—"}</FieldValue>
                  </InlineEditTrigger>
                }
                editContent={
                  <input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEdit()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    className={editInputClass}
                    autoFocus
                  />
                }
                statusContent={<InlineEditStatus status={inlineEditStatus} message={error} />}
              />
            </div>
          </div>

          <div className="min-w-0">
            <FieldLabel>Calendar</FieldLabel>
            <div className="mt-0.5">
              <InlineEditFieldContainer
                isEditing={editingField === "calendar"}
                onRequestClose={commitEdit}
                showSavedIndicator={showSaved && lastSavedFieldRef.current === "calendar"}
                displayContent={
                  <InlineEditTrigger onClick={() => startEdit("calendar", calendarId)}>
                    <FieldValue>{initial.calendarName}</FieldValue>
                  </InlineEditTrigger>
                }
                editContent={
                  <Select
                    value={editValue}
                    onValueChange={(v) => {
                      setEditValue(v);
                      commitEdit(v);
                    }}
                    onBlur={() => commitEdit()}
                    options={calendarOptions}
                    placeholder="Select calendar"
                    className="min-w-0 flex-1 w-full"
                    triggerClassName={editTriggerClass}
                  />
                }
                statusContent={<InlineEditStatus status={inlineEditStatus} message={error} />}
              />
            </div>
          </div>

          <div className="min-w-0">
            <FieldLabel>Internal ID</FieldLabel>
            <p className="mt-0.5">
              <FieldValue>{initial.id.slice(0, 8)}…</FieldValue>
            </p>
          </div>

          <div className="min-w-0">
            <FieldLabel>Type</FieldLabel>
            <div className="mt-0.5">
              <button
                type="button"
                onClick={toggleExternal}
                disabled={submitting}
                className="cursor-pointer inline-flex rounded-full border border-[var(--color-brand-blue)] bg-brand-blue/50 px-3 py-1 text-xs font-medium text-text-primary hover:bg-brand-blue/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExternal ? "External" : "Internal"}
              </button>
            </div>
          </div>
        </div>
      </Panel>

      <div className="pt-4">
        <Button
          variant="ghost"
          className="text-danger hover:bg-danger/10 hover:text-danger"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={submitting || deleting}
        >
          Delete consultant
        </Button>
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
