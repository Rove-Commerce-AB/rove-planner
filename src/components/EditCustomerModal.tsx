"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { updateCustomer, deleteCustomer } from "@/lib/customers";
import { DEFAULT_CUSTOMER_COLOR } from "@/lib/constants";
import { useEscToClose } from "@/lib/useEscToClose";
import { ConfirmModal, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import { CustomerRatesTab } from "./CustomerRatesTab";
import type { CustomerWithDetails } from "@/types";

type Tab = "information" | "rates";

type Props = {
  customer: CustomerWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function EditCustomerModal({
  customer,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("information");
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [color, setColor] = useState(DEFAULT_CUSTOMER_COLOR);
  const [logoUrl, setLogoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setContactName(customer.contactName ?? "");
      setContactEmail(customer.contactEmail ?? "");
      setColor(customer.color ?? DEFAULT_CUSTOMER_COLOR);
      setLogoUrl(customer.logoUrl ?? "");
    }
  }, [customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setError(null);
    if (!name.trim()) {
      setError("Company name is required");
      return;
    }
    setSubmitting(true);
    try {
      await updateCustomer(customer.id, {
        name: name.trim(),
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        color: color.trim() || null,
        logo_url: logoUrl.trim() || null,
      });
      resetForm();
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update customer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!customer) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteCustomer(customer.id);
      setShowDeleteConfirm(false);
      resetForm();
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete customer");
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setContactName("");
    setContactEmail("");
    setColor(DEFAULT_CUSTOMER_COLOR);
    setLogoUrl("");
    setError(null);
    setRatesError(null);
    setActiveTab("information");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  useEscToClose(isOpen, handleClose);

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden
      />
      <div
        className="relative z-10 w-full max-w-md rounded-lg bg-bg-default p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-customer-title"
      >
        <div className="flex items-center justify-between">
          <h2
            id="edit-customer-title"
            className="text-lg font-semibold text-text-primary"
          >
            Edit customer
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

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as Tab)}
          className="mt-4"
        >
          <TabsList>
            <TabsTrigger value="information">Information</TabsTrigger>
            <TabsTrigger value="rates">Hourly rates</TabsTrigger>
          </TabsList>
          <TabsContent value="information" className="mt-6 min-h-[340px]">
          <form
            id="edit-customer-form"
            onSubmit={handleSubmit}
            className="mt-6 space-y-4"
          >
            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <div>
              <label
                htmlFor="edit-customer-name"
                className="block text-sm font-medium text-text-primary"
              >
                Company name
              </label>
              <input
                id="edit-customer-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Company AB"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
              />
            </div>

            <div>
              <label
                htmlFor="edit-customer-contact"
                className="block text-sm font-medium text-text-primary"
              >
                Contact person
              </label>
              <input
                id="edit-customer-contact"
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="John Doe"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
              />
            </div>

            <div>
              <label
                htmlFor="edit-customer-email"
                className="block text-sm font-medium text-text-primary"
              >
                Email
              </label>
              <input
                id="edit-customer-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contact@company.com"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
              />
            </div>

            <div>
              <label
                htmlFor="edit-customer-color"
                className="block text-sm font-medium text-text-primary"
              >
                Color
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="edit-customer-color"
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
                htmlFor="edit-customer-logo"
                className="block text-sm font-medium text-text-primary"
              >
                Logo URL (optional)
              </label>
              <input
                id="edit-customer-logo"
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
              />
            </div>
          </form>
          </TabsContent>
          <TabsContent value="rates" className="mt-6 min-h-[340px]">
            {customer && (
              <CustomerRatesTab
                mode="edit"
                customerId={customer.id}
                onError={setRatesError}
              />
            )}
            {ratesError && (
              <p className="mt-4 text-sm text-danger">{ratesError}</p>
            )}
          </TabsContent>
        </Tabs>

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
              {activeTab === "rates" ? "Close" : "Cancel"}
            </button>
            {activeTab === "information" && (
              <button
                type="submit"
                form="edit-customer-form"
                disabled={submitting || deleting}
                className="rounded-lg bg-brand-signal px-4 py-2 text-sm font-medium text-text-inverse hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete customer"
        message={`Delete ${customer?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
