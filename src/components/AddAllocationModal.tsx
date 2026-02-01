"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Select } from "@/components/ui";
import { getConsultants } from "@/lib/consultants";
import { getProjectsWithCustomer } from "@/lib/projects";
import { getRoles } from "@/lib/roles";
import { createAllocationsForWeekRange } from "@/lib/allocations";
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
  const [hoursPerWeek, setHoursPerWeek] = useState("8");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);


  useEffect(() => {
    if (isOpen) {
      const week = initialWeek ?? weekFrom;
      const allocY = initialYear ?? year;
      setFromWeek(week);
      setToWeek(week);
      setAllocYear(allocY);
      setConsultantId(initialConsultantId ?? "");
      Promise.all([
        getConsultants(),
        getProjectsWithCustomer(),
        getRoles(),
      ])
        .then(([consultantsData, projs, rolesData]) => {
          setConsultants(consultantsData);
          setProjects(projs);
          setRoles(rolesData);
          setConsultantId((prev) =>
            prev || (consultantsData.length > 0 ? consultantsData[0].id : "")
          );
          if (projs.length > 0) setProjectId(projs[0].id);
        })
        .catch(() => {
          setConsultants([]);
          setProjects([]);
          setRoles([]);
        });
    }
  }, [isOpen, year, weekFrom, weekTo, initialConsultantId, initialConsultantName, initialWeek, initialYear]);

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
    const hours = parseFloat(hoursPerWeek);
    if (isNaN(hours) || hours <= 0) {
      setError("Hours must be a positive number");
      return;
    }
    setSubmitting(true);
    try {
      await createAllocationsForWeekRange(
        consultantId,
        projectId,
        roleId,
        allocYear,
        from,
        to,
        hours
      );
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
    setHoursPerWeek("8");
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setConsultantId("");
      setProjectId("");
      setRoleId(null);
      setHoursPerWeek("8");
    }
  }, [isOpen]);

  const from = Math.min(fromWeek, toWeek);
  const to = Math.max(fromWeek, toWeek);
  const weekCount = to - from + 1;

  useEscToClose(isOpen, handleClose);
  const consultantName =
    consultants.find((c) => c.id === consultantId)?.name ?? "";
  const project = projects.find((p) => p.id === projectId);
  const projectLabel = project
    ? `${project.name} (${project.customerName})`
    : "";
  const roleName = roleId
    ? roles.find((r) => r.id === roleId)?.name ?? ""
    : "";
  const hours = parseFloat(hoursPerWeek);
  const isValid = consultantId && projectId && !isNaN(hours) && hours > 0;

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
        aria-labelledby="add-allocation-title"
      >
        <div className="flex items-center justify-between">
          <h2
            id="add-allocation-title"
            className="text-lg font-semibold text-text-primary"
          >
            Add allocation
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

          <Select
            id="alloc-consultant"
            label="Consultant"
            value={consultantId}
            onValueChange={setConsultantId}
            placeholder="Select consultant"
            options={[
              ...(consultantId && initialConsultantName && !consultants.some((c) => c.id === consultantId)
                ? [{ value: consultantId, label: initialConsultantName }]
                : []),
              ...consultants.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          <Select
            id="alloc-project"
            label="Project"
            value={projectId}
            onValueChange={setProjectId}
            placeholder="Select project"
            options={projects.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.customerName})`,
            }))}
          />

          <Select
            id="alloc-role"
            label="Role (optional)"
            value={roleId ?? ""}
            onValueChange={(v) => setRoleId(v ? v : null)}
            placeholder="Select role"
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="alloc-from-week"
                className="block text-sm font-medium text-text-primary"
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
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary"
              />
            </div>
            <div>
              <label
                htmlFor="alloc-to-week"
                className="block text-sm font-medium text-text-primary"
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
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary"
              />
            </div>
          </div>

          <p className="text-xs text-text-primary opacity-60">
            Set the same week for a single week, or different for an interval
            (e.g. v8–v20)
          </p>

          <div>
            <label
              htmlFor="alloc-year"
              className="block text-sm font-medium text-text-primary"
            >
              Year
            </label>
            <input
              id="alloc-year"
              type="number"
              value={allocYear}
              onChange={(e) =>
                setAllocYear(parseInt(e.target.value, 10) || new Date().getFullYear())
              }
              className="mt-1 w-24 rounded-lg border border-border px-3 py-2 text-text-primary"
            />
          </div>

          <div>
            <label
              htmlFor="alloc-hours"
              className="block text-sm font-medium text-text-primary"
            >
              Hours per week
            </label>
            <input
              id="alloc-hours"
              type="number"
              min={0}
              step={0.5}
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(e.target.value)}
              className="mt-1 w-24 rounded-lg border border-border px-3 py-2 text-text-primary"
            />
          </div>

          {isValid && (
            <div className="rounded-lg border border-border bg-bg-muted/50 p-3 text-sm text-text-primary">
              <p className="font-medium">Summary</p>
              <p className="mt-1 opacity-90">
                Adding {hours}h/week for {consultantName} on {projectLabel}
                {roleName ? ` as ${roleName}` : ""} for v{from}–v{to} (
                {allocYear}) — {weekCount} week{weekCount !== 1 ? "s" : ""}
              </p>
            </div>
          )}

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
