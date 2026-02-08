"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus } from "lucide-react";
import { Select, Input, Button } from "@/components/ui";
import { getRoles } from "@/lib/roles";
import {
  getProjectRates,
  createProjectRate,
  updateProjectRate,
  deleteProjectRate,
} from "@/lib/projectRates";
import type { Role } from "@/lib/roles";
import type { ProjectRate } from "@/lib/projectRates";

type Props = {
  projectId: string;
  onError: (msg: string) => void;
  showDescription?: boolean;
};

export function ProjectRatesTab({
  projectId,
  onError,
  showDescription = false,
}: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [rates, setRates] = useState<ProjectRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [newRate, setNewRate] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getRoles();
        if (!cancelled) setRoles(r);
      } catch {
        if (!cancelled) setRoles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProjectRates(projectId)
      .then((r) => {
        if (!cancelled) setRates(r);
      })
      .catch(() => {
        if (!cancelled) setRates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const getRoleName = (roleId: string) =>
    roles.find((r) => r.id === roleId)?.name ?? "Unknown";

  const usedRoleIds = rates.map((r) => r.role_id);
  const availableRoles = roles.filter((r) => !usedRoleIds.includes(r.id));

  const handleAdd = async () => {
    const roleId = selectedRoleId;
    const rateNum = parseFloat(newRate);
    if (!roleId || isNaN(rateNum) || rateNum < 0) {
      onError("Select a role and enter a valid rate");
      return;
    }
    try {
      await createProjectRate(projectId, roleId, rateNum);
      const updated = await getProjectRates(projectId);
      setRates(updated);
      setSelectedRoleId("");
      setNewRate("");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to add rate");
    }
  };

  const handleUpdate = async (rate: ProjectRate, newVal: number) => {
    if (newVal === rate.rate_per_hour) return;
    setUpdatingId(rate.id);
    try {
      await updateProjectRate(rate.id, newVal);
      setRates((prev) =>
        prev.map((r) =>
          r.id === rate.id ? { ...r, rate_per_hour: newVal } : r
        )
      );
      setEditingValue((prev) => {
        const next = { ...prev };
        delete next[rate.id];
        return next;
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to update rate");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemove = async (rate: ProjectRate) => {
    try {
      await deleteProjectRate(rate.id);
      setRates((prev) => prev.filter((r) => r.id !== rate.id));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to remove rate");
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-sm text-text-primary opacity-60">Loading rates…</p>
      ) : (
        <>
          <ul className="space-y-3">
            {rates.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-panel bg-bg-default px-3 py-2"
              >
                <span className="flex-1 text-sm font-medium text-text-primary">
                  {getRoleName(r.role_id)}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={
                    r.id in editingValue ? editingValue[r.id] : String(r.rate_per_hour)
                  }
                  onChange={(e) =>
                    setEditingValue((prev) => ({
                      ...prev,
                      [r.id]: e.target.value,
                    }))
                  }
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (
                      !isNaN(val) &&
                      val >= 0 &&
                      val !== r.rate_per_hour
                    ) {
                      handleUpdate(r, val);
                    }
                  }}
                  disabled={updatingId === r.id}
                  className="w-24 rounded-lg border border-panel bg-bg-default px-3 py-2 text-right text-sm text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-2 focus:ring-brand-signal focus:ring-offset-2 disabled:opacity-50"
                />
                <span className="text-xs text-text-primary opacity-60">SEK/h</span>
                <button
                  type="button"
                  onClick={() => handleRemove(r)}
                  className="rounded-sm p-1.5 text-text-primary opacity-60 hover:bg-danger/10 hover:text-danger"
                  aria-label="Remove rate"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          {availableRoles.length > 0 && (
            <div className="flex flex-nowrap items-end gap-3 border-t border-panel pt-5">
              <div className="min-w-[12rem] w-56 shrink-0">
                <label
                  htmlFor="project-rate-role"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-primary opacity-70"
                >
                  Role
                </label>
                <Select
                  id="project-rate-role"
                  value={selectedRoleId}
                  onValueChange={setSelectedRoleId}
                  placeholder="Select role"
                  options={availableRoles.map((r) => ({
                    value: r.id,
                    label: r.name,
                  }))}
                  size="md"
                  className="w-full"
                  triggerClassName="h-10 border-panel"
                  viewportClassName="max-h-60 overflow-y-auto"
                />
              </div>
              <div className="w-32 shrink-0">
                <label
                  htmlFor="project-rate-value"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-primary opacity-70"
                >
                  Hourly rate (SEK)
                </label>
                <Input
                  id="project-rate-value"
                  type="number"
                  min={0}
                  step={1}
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="h-10 border-panel"
                />
              </div>
              <Button
                type="button"
                onClick={handleAdd}
                className="h-10 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          )}

          {roles.length === 0 && (
            <p className="text-sm text-text-primary opacity-60">
              No roles found. Add roles first to set project rates.
            </p>
          )}

          {rates.length === 0 && roles.length > 0 && (
            <p className="text-sm text-text-primary opacity-60">
              No project-specific rates. Customer rates apply. Add rates here to override.
            </p>
          )}
        </>
      )}
    </div>
  );
}
