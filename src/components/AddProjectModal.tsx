"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Select } from "@/components/ui";
import { createProject } from "@/lib/projects";
import { getCustomers } from "@/lib/customers";
import { useEscToClose } from "@/lib/useEscToClose";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddProjectModal({ isOpen, onClose, onSuccess }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getCustomers()
        .then((c) => {
          setCustomers(c);
          setCustomerId((prev) => (prev || c[0]?.id) ?? "");
        })
        .catch(() => setCustomers([]));
    }
  }, [isOpen]);

  const handleSubmit = async () => {
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
      const project = await createProject({
        name: name.trim(),
        customer_id: customerId,
      });
      resetForm();
      onSuccess();
      onClose();
      router.push(`/projects/${project.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setCustomerId("");
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
        aria-labelledby="add-project-title"
      >
        <div className="flex items-center justify-between">
          <h2
            id="add-project-title"
            className="text-lg font-semibold text-text-primary"
          >
            Create new project
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
            <label
              htmlFor="project-name"
              className="block text-sm font-medium text-text-primary"
            >
              Project name
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Website redesign"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
              autoFocus
            />
          </div>

          <Select
            id="project-customer"
            label="Customer"
            value={customerId}
            onValueChange={setCustomerId}
            placeholder="Select customer"
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
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
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
