"use client";

import { useState, useEffect } from "react";
import { getRoles } from "@/lib/rolesClient";
import { getProjectRates, createProjectRate } from "@/lib/projectRatesClient";
import { Button, Dialog, Input, Select } from "@/components/ui";
import type { Role } from "@/lib/rolesQueries";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
};

export function AddProjectRateModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
}: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [usedRoleIds, setUsedRoleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [rate, setRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !projectId) return;
    setLoading(true);
    setError(null);
    Promise.all([getRoles(), getProjectRates(projectId)])
      .then(([r, rates]) => {
        setRoles(r);
        setUsedRoleIds(rates.map((x) => x.role_id));
      })
      .catch(() => {
        setRoles([]);
        setUsedRoleIds([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, projectId]);

  const availableRoles = roles.filter((r) => !usedRoleIds.includes(r.id));

  const handleSubmit = async () => {
    setError(null);
    const rateNum = parseFloat(rate.replace(",", "."));
    if (!selectedRoleId || isNaN(rateNum) || rateNum < 0) {
      setError("Select a role and enter a valid rate");
      return;
    }
    setSubmitting(true);
    try {
      await createProjectRate(projectId, selectedRoleId, rateNum);
      setSelectedRoleId("");
      setRate("");
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add rate");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedRoleId("");
      setRate("");
      setError(null);
      onClose();
    }
  };

  /* Only show dialog when data is ready so it doesn’t flash loading state (no jump). */
  const dialogOpen = isOpen && !loading;

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange} title="Add rate">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="modal-form-discreet mt-6 space-y-4"
      >
        {loading ? null : (
          <>
            <Select
              id="add-project-rate-role"
              label="Role"
              value={selectedRoleId}
              onValueChange={setSelectedRoleId}
              placeholder="Role"
              variant="modal"
              options={availableRoles.map((r) => ({ value: r.id, label: r.name }))}
            />
            <Input
              id="add-project-rate-value"
              type="number"
              min={0}
              step={1}
              label="Hourly rate (SEK)"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 1200"
              error={error ?? undefined}
              modalStyle
            />
          </>
        )}
        {availableRoles.length === 0 && !loading && (
          <p className="text-sm text-text-primary opacity-60">
            All roles already have rates. Add more roles in Settings to define additional rates.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || loading || availableRoles.length === 0}
          >
            {submitting ? "Adding…" : "Add"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
