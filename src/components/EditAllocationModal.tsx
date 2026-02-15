"use client";

import { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import { getRoles } from "@/lib/roles";
import { updateAllocation, deleteAllocation } from "@/lib/allocations";
import { revalidateAllocationPage } from "@/app/(app)/allocation/actions";
import { useEscToClose } from "@/lib/useEscToClose";
import { ConfirmModal, Select } from "@/components/ui";

type AllocationData = {
  id: string;
  consultantName: string;
  projectName: string;
  customerName: string;
  week: number;
  year: number;
  hours: number;
  roleId: string | null;
  roleName: string;
};

type Props = {
  allocation: AllocationData | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function EditAllocationModal({
  allocation,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [roleId, setRoleId] = useState<string | null>(null);
  const [hours, setHours] = useState("");
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (allocation) {
      setRoleId(allocation.roleId);
      setHours(String(allocation.hours));
    }
  }, [allocation]);

  useEffect(() => {
    if (isOpen) {
      getRoles()
        .then(setRoles)
        .catch(() => setRoles([]));
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!allocation) return;
    setError(null);
    const h = parseFloat(hours);
    if (isNaN(h) || h < 0) {
      setError("Hours must be 0 or a positive number");
      return;
    }
    setSubmitting(true);
    try {
      await updateAllocation(allocation.id, {
        role_id: roleId,
        hours: h,
      });
      await revalidateAllocationPage();
      resetForm();
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update allocation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!allocation) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteAllocation(allocation.id);
      await revalidateAllocationPage();
      setShowDeleteConfirm(false);
      resetForm();
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete allocation");
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setRoleId(null);
    setHours("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  useEscToClose(isOpen, handleClose);

  if (!isOpen || !allocation) return null;

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
        aria-labelledby="edit-allocation-title"
      >
        <div className="flex items-center justify-between">
          <h2
            id="edit-allocation-title"
            className="text-lg font-semibold text-text-primary"
          >
            Edit allocation
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
          className="mt-6 space-y-4"
        >
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary">
              Consultant
            </label>
            <p className="mt-1 text-text-primary">{allocation.consultantName}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary">
              Project
            </label>
            <p className="mt-1 text-text-primary">
              {allocation.projectName} ({allocation.customerName})
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary">
              Week
            </label>
            <p className="mt-1 text-text-primary">
              v{allocation.week}, {allocation.year}
            </p>
          </div>

          <Select
            id="edit-alloc-role"
            label="Role"
            value={roleId ?? ""}
            onValueChange={(v) => setRoleId(v ? v : null)}
            placeholder="No role"
            options={[
              { value: "", label: "No role" },
              ...roles.map((r) => ({ value: r.id, label: r.name })),
              ...(allocation.roleId && allocation.roleName && !roles.some((r) => r.id === allocation.roleId)
                ? [{ value: allocation.roleId, label: allocation.roleName }]
                : []),
            ]}
          />

          <div>
            <label
              htmlFor="edit-alloc-hours"
              className="block text-sm font-medium text-text-primary"
            >
              Hours
            </label>
            <input
              id="edit-alloc-hours"
              type="number"
              min={0}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="mt-1 w-24 rounded-lg border border-border px-3 py-2 text-text-primary"
            />
            <p className="mt-1 text-xs text-text-primary opacity-60">
              Set to 0 to remove the allocation
            </p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
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
                disabled={submitting}
                className="rounded-lg bg-brand-signal px-4 py-2 text-sm font-medium text-text-inverse hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete allocation"
        message="Delete this allocation? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
