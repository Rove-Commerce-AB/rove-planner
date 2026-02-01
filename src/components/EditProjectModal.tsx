"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import {
  updateProject,
  deleteProject,
  getProjectWithDetailsById,
} from "@/lib/projects";
import { useEscToClose } from "@/lib/useEscToClose";
import { ConfirmModal, Select, Switch } from "@/components/ui";
import { getCustomers } from "@/lib/customers";
import type { ProjectWithDetails } from "@/types";

type Props = {
  project: ProjectWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function EditProjectModal({
  project,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && project?.id) {
      getProjectWithDetailsById(project.id)
        .then((fresh) => {
          if (fresh) {
            setName(fresh.name);
            setCustomerId(fresh.customer_id ?? "");
            setIsActive(fresh.isActive);
            setStartDate(fresh.startDate ?? "");
            setEndDate(fresh.endDate ?? "");
          }
        })
        .catch(() => {
          if (project) {
            setName(project.name);
            setCustomerId(project.customer_id ?? "");
            setIsActive(project.isActive);
            setStartDate(project.startDate ?? "");
            setEndDate(project.endDate ?? "");
          }
        });
    }
  }, [isOpen, project]);

  useEffect(() => {
    if (isOpen) {
      getCustomers()
        .then((c) => setCustomers(c))
        .catch(() => setCustomers([]));
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!project) return;
    setError(null);
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    if (!customerId) {
      setError("Customer is required");
      return;
    }
    setSubmitting(true);
    try {
      await updateProject(project.id, {
        name: name.trim(),
        customer_id: customerId,
        is_active: isActive,
        start_date: startDate.trim() || null,
        end_date: endDate.trim() || null,
      });
      resetForm();
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteProject(project.id);
      setShowDeleteConfirm(false);
      resetForm();
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setCustomerId("");
    setIsActive(true);
    setStartDate("");
    setEndDate("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  useEscToClose(isOpen, handleClose);

  if (!isOpen || !project) return null;

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
        aria-labelledby="edit-project-title"
      >
        <div className="flex items-center justify-between">
          <h2
            id="edit-project-title"
            className="text-lg font-semibold text-text-primary"
          >
            Edit project
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
          id="edit-project-form"
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
              htmlFor="edit-project-name"
              className="block text-sm font-medium text-text-primary"
            >
              Project name
            </label>
            <input
              id="edit-project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Website redesign"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
            />
          </div>

          <Select
            id="edit-project-customer"
            label="Customer"
            value={customerId}
            onValueChange={setCustomerId}
            placeholder="Select customer"
            options={(
              customerId && !customers.some((c) => c.id === customerId) && project
                ? [{ value: customerId, label: project.customerName }]
                : []
            ).concat(customers.map((c) => ({ value: c.id, label: c.name })))}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="edit-project-start-date"
                className="block text-sm font-medium text-text-primary"
              >
                Start date
              </label>
              <input
                id="edit-project-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
              />
            </div>
            <div>
              <label
                htmlFor="edit-project-end-date"
                className="block text-sm font-medium text-text-primary"
              >
                End date
              </label>
              <input
                id="edit-project-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
              />
            </div>
          </div>

          <Switch
            id="edit-project-active"
            checked={isActive}
            onCheckedChange={setIsActive}
            label="Active project"
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
              form="edit-project-form"
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
        title="Delete project"
        message={`Delete ${project?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
