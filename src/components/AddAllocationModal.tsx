"use client";

import { useState, useEffect } from "react";
import { Dialog, Select, Button, modalInputClass, modalSelectTriggerClass, modalFocusClass } from "@/components/ui";
import { getConsultantsWithDefaultRole } from "@/lib/consultants";
import {
  getProjectsWithCustomer,
  getProjectsAvailableForConsultant,
} from "@/lib/projects";
import { getRolesWithRateForAllocation } from "@/lib/projectRates";
import { createAllocationsForWeekRange } from "@/lib/allocations";
import {
  createAllocationsByPercent,
  revalidateAllocationPage,
  logBulkAllocationHistory,
} from "@/app/(app)/allocation/actions";
import { TO_PLAN_CONSULTANT_ID } from "@/lib/allocationPage";

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
  /** Pre-fill and lock project when opening from project detail planning panel */
  initialProjectId?: string;
  initialProjectLabel?: string;
};

type Consultant = { id: string; name: string; role_id: string | null };
type Project = {
  id: string;
  name: string;
  customerName: string;
  customer_id: string;
  type: "customer" | "internal" | "absence";
};
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
  initialProjectId,
  initialProjectLabel,
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
      setProjectId(initialProjectId ?? "");
      if (initialWeekFrom != null && initialWeekTo != null) {
        setFromWeek(initialWeekFrom);
        setToWeek(initialWeekTo);
      } else {
        const week = initialWeek ?? weekFrom;
        setFromWeek(week);
        setToWeek(week);
      }
      getConsultantsWithDefaultRole()
        .then(setConsultants)
        .catch(() => setConsultants([]));
    }
  }, [isOpen, year, weekFrom, weekTo, initialConsultantId, initialConsultantName, initialWeek, initialYear, initialWeekFrom, initialWeekTo, initialProjectId]);

  // When consultant changes, load projects available for that consultant (or all if empty / To plan).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    if (!consultantId || consultantId === TO_PLAN_CONSULTANT_ID) {
      getProjectsWithCustomer()
        .then((list) => {
          if (!cancelled) setProjects(list);
        })
        .catch(() => {
          if (!cancelled) setProjects([]);
        });
      return () => {
        cancelled = true;
      };
    }
    setProjects([]);
    getProjectsAvailableForConsultant(consultantId)
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, consultantId]);

  // Set initial consultant only when opening with a pre-selected consultant (e.g. from cell click)
  useEffect(() => {
    if (isOpen && consultants.length > 0 && initialConsultantId) {
      if (consultants.some((c) => c.id === initialConsultantId)) {
        setConsultantId(initialConsultantId);
      }
    }
  }, [isOpen, consultants, initialConsultantId]);

  // When project changes: for customer type load roles with rate and clear role; for internal/absence hide role
  useEffect(() => {
    if (!isOpen || !projectId || projects.length === 0) {
      setRoles([]);
      return;
    }
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      setRoles([]);
      return;
    }
    if (project.type !== "customer") {
      setRoleId(null);
      setRoles([]);
      return;
    }
    setRoleId("");
    let cancelled = false;
    getRolesWithRateForAllocation(projectId, project.customer_id)
      .then((list) => {
        if (!cancelled) setRoles(list);
      })
      .catch(() => {
        if (!cancelled) setRoles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId, projects]);

  // Pre-fill role with consultant's default when project is customer and roles loaded (if that role has a rate)
  useEffect(() => {
    if (!consultantId || !projectId || roles.length === 0) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project || project.type !== "customer") return;
    if (roleId !== "" && roleId !== null) return;
    const consultant = consultants.find((c) => c.id === consultantId);
    const defaultRoleId = consultant?.role_id ?? null;
    if (defaultRoleId && roles.some((r) => r.id === defaultRoleId)) {
      setRoleId(defaultRoleId);
    }
  }, [consultantId, projectId, projects, roles, roleId]);

  const isToPlan = consultantId === TO_PLAN_CONSULTANT_ID;
  const effectiveConsultantId = isToPlan ? null : consultantId;
  /** When opened from consultant row drag: lock consultant; lock project when pre-filled (project page) or after user selects one. */
  const lockFromDrag = !!initialConsultantId;
  const lockConsultant = lockFromDrag;
  const lockProject = lockFromDrag && (!!initialProjectId || !!projectId);

  const handleSubmit = async () => {
    setError(null);
    if (!effectiveConsultantId && !isToPlan) {
      setError("Select a consultant");
      return;
    }
    if (!projectId) {
      setError("Select a project");
      return;
    }
    const project = projects.find((p) => p.id === projectId);
    const effectiveRoleId = project?.type === "customer" ? (roleId || null) : null;
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
          effectiveConsultantId ?? null,
          projectId,
          effectiveRoleId,
          allocYear,
          fromWeek,
          toWeek,
          pct
        );
        onSuccess();
        handleClose();
      } else {
        const hours = parseFloat(hoursPerWeek);
        if (isNaN(hours) || hours < 0.01) {
          setError("Hours must be at least 0.01");
          setSubmitting(false);
          return;
        }
        const records = await createAllocationsForWeekRange(
          effectiveConsultantId ?? null,
          projectId,
          effectiveRoleId,
          allocYear,
          fromWeek,
          toWeek,
          hours
        );
        await revalidateAllocationPage();
        onSuccess();
        handleClose();
        if (records.length > 0) {
          logBulkAllocationHistory(
            records.map((r) => r.id),
            records.reduce((s, r) => s + r.hours, 0)
          ).catch(() => {});
        }
      }
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()} title="Add allocation">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="modal-form-discreet mt-6 space-y-6"
      >
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          {!isToPlan && (
            <div>
              <label
                htmlFor="alloc-consultant"
                className="block text-xs font-medium uppercase tracking-wider text-text-primary opacity-70"
              >
                Consultant
              </label>
              {lockConsultant ? (
                <p id="alloc-consultant" className="mt-1.5 font-medium text-text-primary">
                  {initialConsultantName ?? consultants.find((c) => c.id === consultantId)?.name ?? consultantId}
                </p>
              ) : (
                <Select
                  id="alloc-consultant"
                  value={consultantId === TO_PLAN_CONSULTANT_ID ? "" : consultantId}
                  onValueChange={(v) => {
                    setConsultantId(v);
                    setProjectId("");
                  }}
                  placeholder="Select consultant"
                  variant="modal"
                  triggerClassName={`mt-1.5 ${modalSelectTriggerClass}`}
                  options={[
                    { value: "", label: "Select consultant" },
                    { value: TO_PLAN_CONSULTANT_ID, label: "To plan" },
                    ...(consultantId && initialConsultantName && consultantId !== TO_PLAN_CONSULTANT_ID && !consultants.some((c) => c.id === consultantId)
                      ? [{ value: consultantId, label: initialConsultantName }]
                      : []),
                    ...consultants.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              )}
            </div>
          )}
          {isToPlan && (
            <p className="text-xs font-medium uppercase tracking-wider text-text-primary opacity-70">
              Adding to <strong>To plan</strong>
            </p>
          )}

          <div>
            <label
              htmlFor="alloc-project"
              className="block text-xs font-medium uppercase tracking-wider text-text-primary opacity-70"
            >
              Project
            </label>
            {lockProject ? (
              <p id="alloc-project" className="mt-1.5 font-medium text-text-primary">
                {initialProjectLabel ?? (() => {
                  const p = projects.find((x) => x.id === projectId);
                  return p ? `${p.customerName} - ${p.name}` : projectId;
                })()}
              </p>
            ) : (
              <Select
                id="alloc-project"
                value={projectId}
                onValueChange={setProjectId}
                placeholder="Select project"
                variant="modal"
                triggerClassName={`mt-1.5 ${modalSelectTriggerClass}`}
                viewportClassName="max-h-60 overflow-y-auto"
                options={[...projects]
                  .sort((a, b) => a.customerName.localeCompare(b.customerName))
                  .map((p) => ({
                    value: p.id,
                    label: `${p.customerName} - ${p.name}`,
                  }))}
              />
            )}
          </div>

          <div>
            <label
              htmlFor="alloc-role"
              className="block text-xs font-medium uppercase tracking-wider text-text-primary opacity-70"
            >
              Role
            </label>
            <Select
              id="alloc-role"
              value={roleId ?? ""}
              onValueChange={(v) => setRoleId(v || null)}
              placeholder={
                projects.find((p) => p.id === projectId)?.type !== "customer"
                  ? "Select a customer project first"
                  : "Select role"
              }
              disabled={projects.find((p) => p.id === projectId)?.type !== "customer"}
              variant="modal"
              triggerClassName={`mt-1.5 ${modalSelectTriggerClass}`}
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
                className={`mt-1.5 ${modalInputClass}`}
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
                className={`mt-1.5 ${modalInputClass}`}
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
                  className="rounded-full border-form text-brand-signal focus:ring-brand-signal"
                />
                Hours per week
              </label>
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="radio"
                  name="alloc-mode"
                  checked={inputMode === "percent"}
                  onChange={() => setInputMode("percent")}
                  className="rounded-full border-form text-brand-signal focus:ring-brand-signal"
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
                className={`mt-1.5 w-24 rounded-lg border border-form bg-bg-default px-3 py-2 text-sm text-text-primary ${modalFocusClass}`}
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
                className={`mt-1.5 w-24 rounded-lg border border-form bg-bg-default px-3 py-2 text-sm text-text-primary ${modalFocusClass}`}
              />
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
    </Dialog>
  );
}
