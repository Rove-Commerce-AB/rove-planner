"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { updateProject, deleteProject } from "@/lib/projects";
import { getCustomers } from "@/lib/customers";
import type { ProjectWithDetails, ProjectType } from "@/types";
import {
  ConfirmModal,
  Select,
  Button,
  DetailPageHeader,
  Panel,
} from "@/components/ui";

const tableBorder = "border-panel";

type EditField = "name" | "customerId" | "startDate" | "endDate" | null;

type Props = {
  project: ProjectWithDetails;
};

export function ProjectDetailClient({ project: initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [customerId, setCustomerId] = useState(initial.customer_id);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [type, setType] = useState<ProjectType>(initial.type);
  const [startDate, setStartDate] = useState(initial.startDate ?? "");
  const [endDate, setEndDate] = useState(initial.endDate ?? "");
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingField, setEditingField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState<string>("");

  const syncFromInitial = useCallback(() => {
    setName(initial.name);
    setCustomerId(initial.customer_id);
    setIsActive(initial.isActive);
    setType(initial.type);
    setStartDate(initial.startDate ?? "");
    setEndDate(initial.endDate ?? "");
  }, [initial]);

  useEffect(() => {
    syncFromInitial();
  }, [syncFromInitial]);

  useEffect(() => {
    getCustomers()
      .then((c) => setCustomers(c))
      .catch(() => setCustomers([]));
  }, []);

  const saveField = async (field: EditField, value: string) => {
    if (field == null) return;
    setError(null);
    setSubmitting(true);
    try {
      const trimmed = value.trim();
      switch (field) {
        case "name":
          if (!trimmed) {
            setError("Project name is required");
            setSubmitting(false);
            return;
          }
          await updateProject(initial.id, { name: trimmed });
          setName(trimmed);
          break;
        case "customerId":
          if (!trimmed) {
            setError("Customer is required");
            setSubmitting(false);
            return;
          }
          await updateProject(initial.id, { customer_id: trimmed });
          setCustomerId(trimmed);
          break;
        case "startDate":
          await updateProject(initial.id, {
            start_date: trimmed || null,
          });
          setStartDate(trimmed || "");
          break;
        case "endDate":
          await updateProject(initial.id, {
            end_date: trimmed || null,
          });
          setEndDate(trimmed || "");
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
      await deleteProject(initial.id);
      setShowDeleteConfirm(false);
      router.push("/projects");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await updateProject(initial.id, { is_active: !isActive });
      setIsActive(!isActive);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  const PROJECT_TYPES: ProjectType[] = ["customer", "internal", "absence"];
  const TYPE_LABELS: Record<ProjectType, string> = {
    customer: "Customer project",
    internal: "Internal project",
    absence: "Absence",
  };

  const cycleType = async () => {
    const idx = PROJECT_TYPES.indexOf(type);
    const next = PROJECT_TYPES[(idx + 1) % PROJECT_TYPES.length];
    setError(null);
    setSubmitting(true);
    try {
      await updateProject(initial.id, { type: next });
      setType(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  const projectInitials = initial.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const customerOptions = (() => {
    const base = customers.map((c) => ({ value: c.id, label: c.name }));
    if (
      customerId &&
      initial.customerName &&
      !customers.some((c) => c.id === customerId)
    ) {
      return [{ value: customerId, label: initial.customerName }, ...base];
    }
    return base;
  })();

  const labelClass =
    "text-xs font-medium uppercase tracking-wider text-text-primary opacity-70";
  const valueClass = "font-semibold text-text-primary";

  return (
    <>
      <DetailPageHeader
        backHref={`/customers/${initial.customer_id}`}
        backLabel={`Back to ${initial.customerName ?? "Customer"}`}
        avatar={
          <div
            className="flex h-full w-full items-center justify-center rounded-full"
            style={{ backgroundColor: initial.color }}
            aria-hidden
          >
            <span className="text-xs font-semibold text-text-inverse">
              {projectInitials}
            </span>
          </div>
        }
        title={name}
        subtitle={initial.customerName}
        action={
          <Button
            variant="secondary"
            className="border-danger text-danger hover:bg-danger/10"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={submitting || deleting}
          >
            Delete Project
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
          <h2
            className={`border-b ${tableBorder} bg-bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70`}
          >
            INFORMATION
          </h2>
          <div className="space-y-6 p-5">
            <div>
              <div className={labelClass}>Project name</div>
              {editingField === "name" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="min-w-[120px] flex-1 rounded-lg border-2 border-brand-signal px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                    placeholder="Website redesign"
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
              <div className={labelClass}>Customer</div>
              {editingField === "customerId" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Select
                    value={editValue}
                    onValueChange={setEditValue}
                    options={customerOptions}
                    placeholder="Select customer"
                    className="min-w-[180px]"
                    triggerClassName="!border-2 !border-brand-signal"
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("customerId", editValue)}
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
                    setEditValue(customerId);
                    setEditingField("customerId");
                  }}
                >
                  {initial.customerName ?? "—"}
                </button>
              )}
            </div>
          </div>
        </Panel>

        {/* DATES & STATUS */}
        <Panel>
          <h2
            className={`border-b ${tableBorder} bg-bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70`}
          >
            DATES &amp; STATUS
          </h2>
          <div className="space-y-6 p-5">
            <div>
              <div className={labelClass}>Start date</div>
              {editingField === "startDate" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="min-w-[140px] rounded-lg border-2 border-brand-signal px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("startDate", editValue)}
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
                    setEditValue(startDate);
                    setEditingField("startDate");
                  }}
                >
                  {startDate || "—"}
                </button>
              )}
            </div>

            <div>
              <div className={labelClass}>End date</div>
              {editingField === "endDate" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="min-w-[140px] rounded-lg border-2 border-brand-signal px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("endDate", editValue)}
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
                    setEditValue(endDate);
                    setEditingField("endDate");
                  }}
                >
                  {endDate || "—"}
                </button>
              )}
            </div>

            <div>
              <div className={labelClass}>Type</div>
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={cycleType}
                  disabled={submitting}
                  className="inline-flex rounded-full border border-[var(--color-brand-blue)] bg-brand-blue/50 px-3 py-1 text-xs font-medium text-text-primary hover:bg-brand-blue/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  {TYPE_LABELS[type]}
                </button>
              </div>
            </div>

            <div>
              <div className={labelClass}>Status</div>
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={toggleActive}
                  disabled={submitting}
                  className="inline-flex rounded-full border border-[var(--color-brand-blue)] bg-brand-blue/50 px-3 py-1 text-xs font-medium text-text-primary hover:bg-brand-blue/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  {isActive ? "Active" : "Inactive"}
                </button>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete project"
        message={`Delete ${name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
