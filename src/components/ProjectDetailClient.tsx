"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateProject, deleteProject } from "@/lib/projects";
import { getCustomers } from "@/lib/customers";
import type { ProjectWithDetails } from "@/types";
import {
  ConfirmModal,
  Select,
  Switch,
  Button,
  DetailPageHeader,
  Panel,
  PanelSection,
} from "@/components/ui";
import { FolderKanban } from "lucide-react";

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

  return (
    <>
      <DetailPageHeader
        backHref="/projects"
        backLabel="Back to projects"
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
        title={initial.name}
        subtitle={initial.customerName}
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
            icon={
              <FolderKanban className="h-5 w-5 text-text-primary opacity-70" />
            }
            footer={
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save changes"}
              </Button>
            }
          >
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
                label="Active project"
              />
            </div>
          </PanelSection>
        </Panel>
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
