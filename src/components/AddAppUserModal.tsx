"use client";

import { useState } from "react";
import { addAppUser } from "@/lib/appUsers";
import type { AppUserRole } from "@/lib/appUsers";
import { Button, Dialog, Input } from "@/components/ui";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddAppUserModal({ isOpen, onClose, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppUserRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("email", email.trim());
      formData.set("name", name.trim());
      formData.set("role", role);
      await addAppUser(formData);
      setEmail("");
      setName("");
      setRole("member");
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setEmail("");
      setName("");
      setRole("member");
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange} title="Add user">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="modal-form-discreet mt-6 space-y-4"
      >
        <Input
          id="add-user-email"
          type="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="namn@example.com"
          error={error ?? undefined}
          modalStyle
          autoFocus
        />
        <Input
          id="add-user-name"
          type="text"
          label="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          modalStyle
        />
        <div>
          <label
            htmlFor="add-user-role"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            Role
          </label>
          <select
            id="add-user-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AppUserRole)}
            className="mt-1 h-10 w-full rounded-lg border border-form bg-bg-default px-3 text-sm text-text-primary focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
          >
            <option value="member">Member</option>
            <option value="subcontractor">Subcontractor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
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
