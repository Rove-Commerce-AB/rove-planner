"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Select } from "@/components/ui";
import { getConsultants } from "@/lib/consultants";
import { getProjectsWithCustomer } from "@/lib/projects";
import { getRoles } from "@/lib/roles";
import { createAllocationsForWeekRange } from "@/lib/allocations";
import { createAllocationsByPercent } from "@/app/(app)/allocation/actions";
import { useEscToClose } from "@/lib/useEscToClose";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  year: number;
  weekFrom: number;
  weekTo: number;
  /** Pre-fill consultant and week when opening from a cell click */
  initialConsultantId?: string;
  initialConsultantName?: string;
  initialWeek?: number;
  initialYear?: number;
  /** Pre-fill week range when opening from header drag */
  initialWeekFrom?: number;
  initialWeekTo?: number;
};

type Consultant = { id: string; name: string };
type Project = { id: string; name: string; customerName: string };
type Role = { id: string; name: string };

export function AddAllocationModal({
  isOpen,
  onClose,
  onSuccess,
  year,
  weekFrom,
  weekTo,
  initialConsultantId,
  initialConsultantName,
  initialWeek,
  initialYear,
  initialWeekFrom,
  initialWeekTo,
}: Props) {
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [consultantId, setConsultantId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [fromWeek, setFromWeek] = useState(weekFrom);
  const [toWeek, setToWeek] = useState(weekTo);
  const [allocYear, setAllocYear] = useState(year);
  const [inputMode, setInputMode] = useState<"hours" | "percent">("hours");
  const [hoursPerWeek, setHoursPerWeek] = useState("8");
  const [percent, setPercent] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);


  useEffect(() => {
    if (isOpen) {
      const allocY = initialYear ?? year;
      setAllocYear(allocY);
      setConsultantId(initialConsultantId ?? "");
      if (initialWeekFrom != null && initialWeekTo != null) {
        setFromWeek(initialWeekFrom);
        setToWeek(initialWeekTo);
      } else {
        const week = initialWeek ?? weekFrom;
        setFromWeek(week);
        setToWeek(week);
      }
      Promise.all([
        getConsultants(),
        getProjectsWithCustomer(),
        getRoles(),
      ])
        .then(([consultantsData, projs, rolesData]) => {
          setConsultants(consultantsData);
          setProjects(projs);
          setRoles(rolesData);
        })
        .catch(() => {
          setConsultants([]);
          setProjects([]);
          setRoles([]);
        });
    }
  }, [isOpen, year, weekFrom, weekTo, initialConsultantId, initialConsultantName, initialWeek, initialYear, initialWeekFrom, initialWeekTo]);

  // Set default consultant only after options are loaded so Select gets value + options together
  useEffect(() => {
    if (isOpen && consultants.length > 0 && !consultantId) {
      setConsultantId(
        initialConsultantId && consultants.some((c) => c.id === initialConsultantId)
          ? initialConsultantId
          : consultants[0].id
      );
    }
  }, [isOpen, consultants, consultantId, initialConsultantId]);

  const handleSubmit = async () => {
    setError(null);
    if (!consultantId) {
      setError("Select a consultant");
      return;
    }
    if (!projectId) {
      setError("Select a project");
      return;
    }
    const from = Math.min(fromWeek, toWeek);
    const to = Math.max(fromWeek, toWeek);
    setSubmitting(true);
    try {
      if (inputMode === "percent") {
        const pct = parseFloat(percent);
        if (isNaN(pct) || pct < 0 || pct > 100) {
          setError("Percent must be between 0 and 100");
          setSubmitting(false);
          return;
        }
        await createAllocationsByPercent(
          consultantId,
          projectId,
          roleId,
          allocYear,
          from,
          to,
          pct
        );
      } else {
        const hours = parseFloat(hoursPerWeek);
        if (isNaN(hours) || hours < 0.01) {
          setError("Hours must be at least 0.01");
          setSubmitting(false);
          return;
        }
        await createAllocationsForWeekRange(
          consultantId,
          projectId,
          roleId,
          allocYear,
          from,
          to,
          hours
        );
      }
      onSuccess();
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add allocation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setConsultantId("");
    setProjectId("");
    setRoleId(null);
    setFromWeek(weekFrom);
    setToWeek(weekTo);
    setAllocYear(year);
    setInputMode("hours");
    setHoursPerWeek("8");
    setPercent("100");
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setConsultantId("");
      setProjectId("");
      setRoleId(null);
      setInputMode("hours");
      setHoursPerWeek("8");
      setPercent("100");
    }
  }, [isOpen]);

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
        className="w-full max-w-md overflow-hidden rounded-panel border border-panel bg-bg-default shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-allocation-title"
      >
        <div className="flex items-center justify-between border-b border-panel bg-bg-muted/40 px-4 py-3">
          <h2
            id="add-allocation-title"
            className="text-xs font-medium uppercase tracking-wider text-text-primary opacity-70"
          >
            Add allocation
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
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-6 p-5"
        >
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div>
            <label
              htmlFor="alloc-consultant"
              className="block text-xs font-medium uppercase tracking-wider text-text-primary opacity-70"
            >
              Consultant
            </label>
            <Select
              id="alloc-consultant"
              value={consultantId}
              onValueChange={setConsultantId}
              placeholder="Select consultant"
              triggerClassName="mt-1.5 border-panel"
              options={[
                ...(consultantId && initialConsultantName && !consultants.some((c) => c.id === consultantId)
                  ? [{ value: consultantId, label: initialConsultantName }]
                  : []),
                ...consultants.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>

          <div>
            <label
              htmlFor="alloc-project"
              className="block text-xs font-medium uppercase tracking-wider text-text-primary opacity-70"
            >
              Project
            </label>
            <Select
              id="alloc-project"
              value={projectId}
              onValueChange={setProjectId}
              placeholder="Select project"
              triggerClassName="mt-1.5 border-panel"
              options={projects.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.customerName})`,
              }))}
            />
          </div>

          <div>
            <label
              htmlFor="alloc-role"
              className="block text-xs font-medium uppercase tracking-wider text-text-primary opacity-70"
            >
              Role (optional)
            </label>
            <Select
              id="alloc-role"
              value={roleId ?? ""}
              onValueChange={(v) => setRoleId(v ? v : null)}
              placeholder="Select role"
              triggerClassName="mt-1.5 border-panel"
              options={roles.map((r) => ({ value: r.id, label: r.name }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="alloc-from-week"
                className="block text-xs font-medium uppercase tracking-wider text-text-primary opacity-70"
              >
                From week
              </label>
              <input
                id="alloc-from-week"
                type="number"
                min={1}
                max={52}
                value={fromWeek}
                onChange={(e) => setFromWeek(parseInt(e.target.value, 10) || 1)}
                className="mt-1.5 w-full rounded-lg border border-panel px-3 py-2 text-text-primary focus:border-brand-signal focus:outline-none focus:ring-2 focus:ring-brand-signal"
              />
            </div>
            <div>
              <label
                htmlFor="alloc-to-week"
                className="block text-xs font-medium uppercase tracking-wider text-text-primary opacity-70"
              >
                To week
              </label>
              <input
                id="alloc-to-week"
                type="number"
                min={1}
                max={52}
                value={toWeek}
                onChange={(e) => setToWeek(parseInt(e.target.value, 10) || 1)}
                className="mt-1.5 w-full rounded-lg border border-panel px-3 py-2 text-text-primary focus:border-brand-signal focus:outline-none focus:ring-2 focus:ring-brand-signal"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="radio"
                  name="alloc-mode"
                  checked={inputMode === "hours"}
                  onChange={() => setInputMode("hours")}
                  className="rounded-full border-border text-brand-signal focus:ring-brand-signal"
                />
                Hours per week
              </label>
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="radio"
                  name="alloc-mode"
                  checked={inputMode === "percent"}
                  onChange={() => setInputMode("percent")}
                  className="rounded-full border-border text-brand-signal focus:ring-brand-signal"
                />
                % of available week
              </label>
            </div>
            {inputMode === "hours" ? (
              <input
                id="alloc-hours"
                type="number"
                min={0}
                step={0.5}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
                className="mt-1.5 w-24 rounded-lg border border-panel px-3 py-2 text-text-primary focus:border-brand-signal focus:outline-none focus:ring-2 focus:ring-brand-signal"
              />
            ) : (
              <input
                id="alloc-percent"
                type="number"
                min={0}
                max={100}
                step={5}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="mt-1.5 w-24 rounded-lg border border-panel px-3 py-2 text-text-primary focus:border-brand-signal focus:outline-none focus:ring-2 focus:ring-brand-signal"
              />
            )}
          </div>

          <div className="flex justify-end gap-2">
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
