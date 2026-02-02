"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createCustomer } from "@/lib/customers";
import { useEscToClose } from "@/lib/useEscToClose";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddCustomerModal({ isOpen, onClose, onSuccess }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Company name is required");
      return;
    }
    setSubmitting(true);
    try {
      const customer = await createCustomer({
        name: name.trim(),
      });
      onSuccess();
      onClose();
      router.push(`/customers/${customer.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add customer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setName("");
    setError(null);
    onClose();
  };

  useEscToClose(isOpen, handleClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden
      />
      <div
        className="relative z-10 w-full max-w-md rounded-lg bg-bg-default p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-customer-title"
      >
        <div className="flex items-center justify-between">
          <h2
            id="add-customer-title"
            className="text-lg font-semibold text-text-primary"
          >
            Add new customer
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

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

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
              autoFocus
            />
          </div>

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
              {submitting ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
