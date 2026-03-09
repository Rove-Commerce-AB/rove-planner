"use client";

import { useState, useEffect } from "react";
import { Dialog, Select, Button, modalSelectTriggerClass } from "@/components/ui";
import { getConsultantsWithDefaultRole } from "@/lib/consultants";
import { addConsultantToCustomer } from "@/lib/customerConsultants";
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

        <Select
          id="add-consultant-select"
          label="Consultant"
          value={selectedId}
          onValueChange={setSelectedId}
          placeholder="Select consultant"
          variant="modal"
          triggerClassName={modalSelectTriggerClass}
          options={options}
        />

        {options.length === 0 && allConsultants.length > 0 && (
          <p className="text-sm text-text-primary opacity-70">
            All consultants are already assigned to this customer.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
