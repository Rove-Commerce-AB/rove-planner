"use client";

import { useState, useEffect } from "react";
import { Dialog, Button } from "@/components/ui";
import { getConsultantsWithDefaultRole } from "@/lib/consultantsClient";
import { addConsultantToCustomer } from "@/lib/customerConsultantsClient";
import type { CustomerConsultant } from "@/lib/customerConsultantsQueries";

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSelectedIds([]);
      getConsultantsWithDefaultRole()
        .then(setAllConsultants)
        .catch(() => setAllConsultants([]));
    }
  }, [isOpen]);

  const existingIds = new Set(existingConsultants.map((c) => c.id));
  const options = allConsultants
    .filter((c) => !existingIds.has(c.id))
    .map((c) => ({ value: c.id, label: c.name }));

  const toggleConsultant = (consultantId: string) => {
    setSelectedIds((prev) =>
      prev.includes(consultantId)
        ? prev.filter((id) => id !== consultantId)
        : [...prev, consultantId]
    );
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) {
      setError("Select at least one consultant");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await Promise.all(
        selectedIds.map((consultantId) =>
          addConsultantToCustomer(customerId, consultantId)
        )
      );
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add consultant");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange} title="Add consultant">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="modal-form-discreet mt-6 space-y-4"
      >
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {options.length > 0 && (
          <div>
            <p className="mb-2 block text-sm font-medium text-text-primary">
              Consultants
            </p>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-form bg-bg-default p-3">
              {options.map((option) => (
                <label
                  key={option.value}
                  htmlFor={`add-consultant-${option.value}`}
                  className="flex cursor-pointer items-center gap-2 text-sm text-text-primary"
                >
                  <input
                    id={`add-consultant-${option.value}`}
                    type="checkbox"
                    checked={selectedIds.includes(option.value)}
                    onChange={() => toggleConsultant(option.value)}
                    disabled={submitting}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {options.length === 0 && allConsultants.length > 0 && (
          <p className="text-sm text-text-primary opacity-70">
            All consultants are already assigned to this customer.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || options.length === 0}
          >
            {submitting ? "Adding…" : "Add selected"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
