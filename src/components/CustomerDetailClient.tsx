"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateCustomer, deleteCustomer } from "@/lib/customers";
import { DEFAULT_CUSTOMER_COLOR } from "@/lib/constants";
import {
  Button,
  ConfirmModal,
  DetailPageHeader,
  Panel,
  PanelSection,
} from "@/components/ui";
import { CustomerRatesTab } from "./CustomerRatesTab";
import { Building2, DollarSign, FolderOpen } from "lucide-react";
import type { CustomerWithDetails } from "@/types";

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
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setName(initialCustomer.name);
    setContactName(initialCustomer.contactName ?? "");
    setContactEmail(initialCustomer.contactEmail ?? "");
    setColor(initialCustomer.color ?? DEFAULT_CUSTOMER_COLOR);
    setLogoUrl(initialCustomer.logoUrl ?? "");
  }, [initialCustomer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!name.trim()) {
      setError("Company name is required");
      return;
    }
    setSubmitting(true);
    try {
      await updateCustomer(initialCustomer.id, {
        name: name.trim(),
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        color: color.trim() || null,
        logo_url: logoUrl.trim() || null,
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

  return (
    <>
      <DetailPageHeader
        backHref="/customers"
        backLabel="Back to customers"
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
              style={{ backgroundColor: initialCustomer.color }}
            >
              {initialCustomer.initials}
            </div>
          )
        }
        title={initialCustomer.name}
        subtitle={subtitle}
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

      <div className="max-w-6xl">
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form onSubmit={handleSubmit}>
            <Panel>
              <PanelSection
                title="Customer information"
                icon={
                  <Building2 className="h-5 w-5 text-text-primary opacity-70" />
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
                      htmlFor="customer-name"
                      className="block text-sm font-medium text-text-primary"
                    >
                      Company name
                    </label>
                    <input
                      id="customer-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Company AB"
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="customer-contact"
                      className="block text-sm font-medium text-text-primary"
                    >
                      Contact person
                    </label>
                    <input
                      id="customer-contact"
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="John Doe"
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="customer-email"
                      className="block text-sm font-medium text-text-primary"
                    >
                      Email
                    </label>
                    <input
                      id="customer-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="contact@company.com"
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="customer-color"
                      className="block text-sm font-medium text-text-primary"
                    >
                      Color
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        id="customer-color"
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        placeholder={DEFAULT_CUSTOMER_COLOR}
                        className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="customer-logo"
                      className="block text-sm font-medium text-text-primary"
                    >
                      Logo URL (optional)
                    </label>
                    <input
                      id="customer-logo"
                      type="url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
                    />
                  </div>
                </div>
              </PanelSection>
            </Panel>
          </form>

          <Panel>
            <PanelSection
              title="Hourly rates per role"
              icon={
                <DollarSign className="h-5 w-5 text-text-primary opacity-70" />
              }
              description="Set hourly rate per role for this customer. If no rate is specified, the standard rate will be used."
            >
              {ratesError && (
                <p className="mb-4 text-sm text-danger">{ratesError}</p>
              )}
              <CustomerRatesTab
                mode="edit"
                customerId={initialCustomer.id}
                onError={setRatesError}
                showDescription={false}
              />
            </PanelSection>
          </Panel>
        </div>

        <Panel className="mt-6">
          <PanelSection
            title={`Projects (${initialCustomer.projects.length})`}
            icon={
              <FolderOpen className="h-5 w-5 text-text-primary opacity-70" />
            }
          >
            {initialCustomer.projects.length === 0 ? (
              <p className="text-sm text-text-primary opacity-70">
                No projects for this customer.
              </p>
            ) : (
              <ul className="space-y-2">
                {initialCustomer.projects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center justify-between rounded-lg border border-border bg-bg-muted/50 px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-muted"
                    >
                      <span>{p.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.isActive
                            ? "bg-success/20 text-success"
                            : "text-text-primary opacity-70"
                        }`}
                      >
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </PanelSection>
        </Panel>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete customer"
        message={`Delete ${initialCustomer.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
