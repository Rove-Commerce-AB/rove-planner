"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { updateCustomer, deleteCustomer } from "@/lib/customers";
import { DEFAULT_CUSTOMER_COLOR } from "@/lib/constants";
import {
  Button,
  ConfirmModal,
  DetailPageHeader,
  Panel,
} from "@/components/ui";
import { CustomerRatesTab } from "./CustomerRatesTab";
import { AddProjectModal } from "./AddProjectModal";
import type { CustomerWithDetails } from "@/types";

const tableBorder = "border-panel";

type EditField =
  | "name"
  | "contactName"
  | "contactEmail"
  | "color"
  | "logoUrl"
  | null;

type Props = {
  customer: CustomerWithDetails;
};

export function CustomerDetailClient({ customer: initialCustomer }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialCustomer.name);
  const [contactName, setContactName] = useState(
    initialCustomer.contactName ?? ""
  );
  const [contactEmail, setContactEmail] = useState(
    initialCustomer.contactEmail ?? ""
  );
  const [color, setColor] = useState(
    initialCustomer.color ?? DEFAULT_CUSTOMER_COLOR
  );
  const [logoUrl, setLogoUrl] = useState(initialCustomer.logoUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [addProjectModalOpen, setAddProjectModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [logoImageError, setLogoImageError] = useState(false);

  const syncFromInitial = useCallback(() => {
    setName(initialCustomer.name);
    setContactName(initialCustomer.contactName ?? "");
    setContactEmail(initialCustomer.contactEmail ?? "");
    setColor(initialCustomer.color ?? DEFAULT_CUSTOMER_COLOR);
    setLogoUrl(initialCustomer.logoUrl ?? "");
    setLogoImageError(false);
  }, [initialCustomer]);

  useEffect(() => {
    syncFromInitial();
  }, [syncFromInitial]);

  const saveField = async (field: EditField, value: string) => {
    if (field == null) return;
    setError(null);
    setSubmitting(true);
    try {
      const trimmed = value.trim();
      switch (field) {
        case "name":
          if (!trimmed) {
            setError("Company name is required");
            setSubmitting(false);
            return;
          }
          await updateCustomer(initialCustomer.id, { name: trimmed });
          setName(trimmed);
          break;
        case "contactName":
          await updateCustomer(initialCustomer.id, {
            contact_name: trimmed || null,
          });
          setContactName(trimmed || "");
          break;
        case "contactEmail":
          await updateCustomer(initialCustomer.id, {
            contact_email: trimmed || null,
          });
          setContactEmail(trimmed || "");
          break;
        case "color":
          await updateCustomer(initialCustomer.id, {
            color: trimmed || null,
          });
          setColor(trimmed || DEFAULT_CUSTOMER_COLOR);
          break;
        case "logoUrl":
          await updateCustomer(initialCustomer.id, {
            logo_url: trimmed || null,
          });
          setLogoUrl(trimmed || "");
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
      await deleteCustomer(initialCustomer.id);
      setShowDeleteConfirm(false);
      router.push("/customers");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const subtitle =
    initialCustomer.activeProjectCount === 1
      ? "1 active project"
      : `${initialCustomer.activeProjectCount} active projects`;

  const labelClass =
    "text-xs font-medium uppercase tracking-wider text-text-primary opacity-70";
  const valueClass = "font-semibold text-text-primary";

  return (
    <>
      <DetailPageHeader
        backHref="/customers"
        backLabel="Back to Customers"
        avatar={
          initialCustomer.logoUrl ? (
            <img
              src={initialCustomer.logoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center rounded-full text-text-inverse"
              style={{ backgroundColor: color }}
            >
              {initialCustomer.initials}
            </div>
          )
        }
        title={name}
        subtitle={subtitle}
        action={
          <Button
            variant="secondary"
            className="border-danger text-danger hover:bg-danger/10"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={submitting || deleting}
          >
            Delete Customer
          </Button>
        }
      />

      <div className="max-w-6xl">
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
                <div className={labelClass}>Company name</div>
                {editingField === "name" ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="min-w-[120px] flex-1 rounded-lg border-2 border-brand-signal px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                      placeholder="Company AB"
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
                <div className={labelClass}>Contact person</div>
                {editingField === "contactName" ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="min-w-[120px] flex-1 rounded-lg border-2 border-brand-signal px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                      placeholder="John Doe"
                      autoFocus
                    />
                    <Button
                      type="button"
                      onClick={() => saveField("contactName", editValue)}
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
                      setEditValue(contactName);
                      setEditingField("contactName");
                    }}
                  >
                    {contactName || "—"}
                  </button>
                )}
              </div>

              <div>
                <div className={labelClass}>Email</div>
                {editingField === "contactEmail" ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <input
                      type="email"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="min-w-[120px] flex-1 rounded-lg border-2 border-brand-signal px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                      placeholder="contact@company.com"
                      autoFocus
                    />
                    <Button
                      type="button"
                      onClick={() => saveField("contactEmail", editValue)}
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
                    className={`mt-1.5 block text-left ${valueClass} hover:underline ${contactEmail ? "text-brand-signal" : "text-text-primary opacity-70"}`}
                    onClick={() => {
                      setEditValue(contactEmail);
                      setEditingField("contactEmail");
                    }}
                  >
                    {contactEmail || "—"}
                  </button>
                )}
              </div>

              <div>
                <div className={labelClass}>Color</div>
                {editingField === "color" ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <input
                      type="color"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={DEFAULT_CUSTOMER_COLOR}
                      className="min-w-[100px] flex-1 rounded-lg border-2 border-brand-signal px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                      autoFocus
                    />
                    <Button
                      type="button"
                      onClick={() => saveField("color", editValue)}
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
                    className="mt-1.5 flex items-center gap-2 text-left"
                    onClick={() => {
                      setEditValue(color);
                      setEditingField("color");
                    }}
                  >
                    <span
                      className="h-6 w-6 flex-shrink-0 rounded border border-border"
                      style={{ backgroundColor: color }}
                    />
                    <span className={`${valueClass} hover:underline`}>
                      {color}
                    </span>
                  </button>
                )}
              </div>

              <div>
                <div className={labelClass}>Logo URL</div>
                {editingField === "logoUrl" ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <input
                      type="url"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="min-w-[120px] flex-1 rounded-lg border-2 border-brand-signal px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                      placeholder="https://example.com/logo.png"
                      autoFocus
                    />
                    <Button
                      type="button"
                      onClick={() => saveField("logoUrl", editValue)}
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
                    className="mt-1.5 block text-left"
                    onClick={() => {
                      setEditValue(logoUrl);
                      setEditingField("logoUrl");
                    }}
                  >
                    {logoUrl && !logoImageError ? (
                      <img
                        src={logoUrl}
                        alt="Customer logo"
                        className="max-h-12 max-w-[180px] object-contain"
                        onError={() => setLogoImageError(true)}
                      />
                    ) : logoUrl ? (
                      <span className={`${valueClass} text-brand-signal hover:underline`}>
                        {logoUrl}
                      </span>
                    ) : (
                      <span className={`${valueClass} text-text-primary opacity-70 hover:underline`}>
                        —
                      </span>
                    )}
                    {logoUrl && !logoImageError ? (
                      <span className="sr-only">Click to edit logo URL</span>
                    ) : null}
                  </button>
                )}
              </div>
            </div>
          </Panel>

          {/* RATES/TASKS */}
          <Panel>
            <h2
              className={`border-b ${tableBorder} bg-bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70`}
            >
              RATES/TASKS
            </h2>
            <div className="p-5">
              {ratesError && (
                <p className="mb-4 text-sm text-danger">{ratesError}</p>
              )}
              <CustomerRatesTab
                mode="edit"
                customerId={initialCustomer.id}
                onError={setRatesError}
                showDescription={false}
              />
            </div>
          </Panel>
        </div>

        {/* PROJECTS */}
        <Panel className="mt-6">
          <div
            className={`flex flex-col gap-3 border-b ${tableBorder} bg-bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}
          >
            <h2 className="text-xs font-medium uppercase tracking-wider text-text-primary opacity-70">
              PROJECTS ({initialCustomer.projects.length})
            </h2>
            <Button
              type="button"
              onClick={() => setAddProjectModalOpen(true)}
            >
              Add Project
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[200px] text-sm">
              <thead>
                <tr className={`border-b ${tableBorder} bg-bg-muted/80`}>
                  <th className="px-4 py-3 text-left font-medium text-text-primary">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-primary">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {initialCustomer.projects.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className={`border-b ${tableBorder} px-4 py-6 text-center text-sm text-text-primary opacity-60`}
                    >
                      No projects for this customer.
                    </td>
                  </tr>
                ) : (
                  initialCustomer.projects.map((p) => (
                    <tr
                      key={p.id}
                      className="cursor-pointer transition-colors hover:bg-bg-muted/50"
                      onClick={() => router.push(`/projects/${p.id}`)}
                    >
                      <td className={`border-b ${tableBorder} px-4 py-3 font-medium text-text-primary`}>
                        {p.name}
                      </td>
                      <td className={`border-b ${tableBorder} px-4 py-3 text-text-primary`}>
                        {p.type === "customer"
                          ? "Customer"
                          : p.type === "internal"
                            ? "Internal"
                            : "Absence"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <AddProjectModal
        isOpen={addProjectModalOpen}
        onClose={() => setAddProjectModalOpen(false)}
        onSuccess={() => router.refresh()}
        initialCustomerId={initialCustomer.id}
        redirectToProject={false}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete customer"
        message={`Delete ${name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
