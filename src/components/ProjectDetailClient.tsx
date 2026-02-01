"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateProject,
  deleteProject,
} from "@/lib/projects";
import { getCustomers } from "@/lib/customers";
import type { ProjectWithDetails } from "@/types";
import { ConfirmModal, Select, Switch, Button, PageHeader } from "@/components/ui";

type Props = {
  project: ProjectWithDetails;
};

export function ProjectDetailClient({ project: initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [customerId, setCustomerId] = useState(initial.customer_id);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [startDate, setStartDate] = useState(initial.startDate ?? "");
  const [endDate, setEndDate] = useState(initial.endDate ?? "");
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setName(initial.name);
    setCustomerId(initial.customer_id);
    setIsActive(initial.isActive);
    setStartDate(initial.startDate ?? "");
    setEndDate(initial.endDate ?? "");
  }, [initial]);

  useEffect(() => {
    getCustomers()
      .then((c) => setCustomers(c))
      .catch(() => setCustomers([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
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
      await updateProject(initial.id, {
        name: name.trim(),
        customer_id: customerId,
        is_active: isActive,
        start_date: startDate.trim() || null,
        end_date: endDate.trim() || null,
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

  return (
    <>
      <PageHeader
        title={initial.name}
        description="Project details"
        className="mb-6"
      >
        <Button
          variant="danger"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={submitting || deleting}
        >
          Delete
        </Button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="text-sm text-success" role="status">
            Saved
          </p>
        )}

        <section className="rounded-lg border border-border bg-bg-default p-6">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">
            Information
          </h2>
          <div className="space-y-4">
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
              />
            </div>

            <Select
              id="project-customer"
              label="Customer"
              value={customerId}
              onValueChange={setCustomerId}
              placeholder="Select customer"
              options={customerOptions}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="project-start-date"
                  className="block text-sm font-medium text-text-primary"
                >
                  Start date
                </label>
                <input
                  id="project-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
                />
              </div>
              <div>
                <label
                  htmlFor="project-end-date"
                  className="block text-sm font-medium text-text-primary"
                >
                  End date
                </label>
                <input
                  id="project-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
                />
              </div>
            </div>

            <Switch
              id="project-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              label="Aktivt projekt"
            />
          </div>
          <div className="mt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </section>
      </form>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete project"
        message={`Delete ${initial.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
