"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Select, Button } from "@/components/ui";
import { getConsultantsWithDefaultRole } from "@/lib/consultants";
import { addConsultantToCustomer } from "@/lib/customerConsultants";
import { useEscToClose } from "@/lib/useEscToClose";
import type { CustomerConsultant } from "@/lib/customerConsultants";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerId: string;
  existingConsultants: CustomerConsultant[];
};

export function AddCustomerConsultantModal({
  isOpen,
  onClose,
  onSuccess,
  customerId,
  existingConsultants,
}: Props) {
  const [allConsultants, setAllConsultants] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSelectedId("");
      getConsultantsWithDefaultRole()
        .then(setAllConsultants)
        .catch(() => setAllConsultants([]));
    }
  }, [isOpen]);

  const existingIds = new Set(existingConsultants.map((c) => c.id));
  const options = allConsultants
    .filter((c) => !existingIds.has(c.id))
    .map((c) => ({ value: c.id, label: c.name }));

  const handleSubmit = async () => {
    if (!selectedId) {
      setError("Select a consultant");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await addConsultantToCustomer(customerId, selectedId);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add consultant");
    } finally {
      setSubmitting(false);
    }
  };

  useEscToClose(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-panel border border-panel bg-bg-default shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-consultant-title"
      >
        <div className="flex items-center justify-between border-b border-panel bg-bg-muted/40 px-4 py-3">
          <h2
            id="add-consultant-title"
            className="text-xs font-medium uppercase tracking-wider text-text-primary opacity-70"
          >
            Add consultant
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm p-1 text-text-primary opacity-60 hover:bg-bg-muted hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <div>
            <label
              htmlFor="add-consultant-select"
              className="block text-xs font-medium uppercase tracking-wider text-text-primary opacity-70"
            >
              Consultant
            </label>
            <Select
              id="add-consultant-select"
              value={selectedId}
              onValueChange={setSelectedId}
              placeholder="Select consultant"
              triggerClassName="mt-1.5 border-panel"
              options={options}
            />
          </div>
          {options.length === 0 && allConsultants.length > 0 && (
            <p className="text-sm text-text-primary opacity-70">
              All consultants are already assigned to this customer.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !selectedId}
            >
              {submitting ? "Adding…" : "Add"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
