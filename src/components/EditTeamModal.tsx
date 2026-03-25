"use client";

import { useState, useEffect } from "react";
import { updateTeam } from "@/lib/teamsClient";
import { Button, Dialog, Input } from "@/components/ui";

type Props = {
  team: { id: string; name: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function EditTeamModal({
  team,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (team) setName(team.name);
  }, [team]);

  const handleSubmit = async () => {
    if (!team) return;
    setError(null);
    if (!name.trim()) {
      setError("Team name is required");
      return;
    }
    setSubmitting(true);
    try {
      await updateTeam(team.id, name.trim());
      setName("");
      setError(null);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update team");
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

  if (!team) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange} title="Edit team">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="modal-form-discreet mt-6 space-y-4"
      >
        <Input
          id="edit-team-name"
          label="Team name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Team Sthlm"
          error={error ?? undefined}
          modalStyle
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
