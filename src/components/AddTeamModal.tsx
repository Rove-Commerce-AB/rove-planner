"use client";

import { useState } from "react";
import { createTeam } from "@/lib/teams";
import { Button, Dialog, Input } from "@/components/ui";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddTeamModal({ isOpen, onClose, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Team name is required");
      return;
    }
    setSubmitting(true);
    try {
      await createTeam(name.trim());
      setName("");
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add team");
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
    <Dialog open={isOpen} onOpenChange={handleOpenChange} title="Add team">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="mt-6 space-y-4"
      >
        <Input
          id="team-name"
          label="Team name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Team Sthlm"
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
