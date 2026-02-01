"use client";

import { useState, useEffect } from "react";
import { updateRole } from "@/lib/roles";
import { Button, Dialog, Input } from "@/components/ui";

type Props = {
  role: { id: string; name: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function EditRoleModal({
  role,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (role) setName(role.name);
  }, [role]);

  const handleSubmit = async () => {
    if (!role) return;
    setError(null);
    if (!name.trim()) {
      setError("Role name is required");
      return;
    }
    setSubmitting(true);
    try {
      await updateRole(role.id, name.trim());
      setName("");
      setError(null);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role");
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

  if (!role) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange} title="Edit role">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="mt-6 space-y-4"
      >
        <Input
          id="edit-role-name"
          label="Role name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Senior Developer"
          error={error ?? undefined}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
