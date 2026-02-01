"use client";

import { useState } from "react";
import { createRole } from "@/lib/roles";
import { Button, Dialog, Input } from "@/components/ui";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddRoleModal({ isOpen, onClose, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Role name is required");
      return;
    }
    setSubmitting(true);
    try {
      await createRole(name.trim());
      setName("");
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add role");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName("");
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange} title="Add role">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="mt-6 space-y-4"
      >
        <Input
          id="role-name"
          label="Role name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Senior Developer"
          error={error ?? undefined}
          autoFocus
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
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
