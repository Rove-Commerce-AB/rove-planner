"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus } from "lucide-react";
import { Select, Input, Button } from "@/components/ui";
import { getRoles } from "@/lib/roles";
import {
  getCustomerRates,
  createCustomerRate,
  updateCustomerRate,
  deleteCustomerRate,
} from "@/lib/customerRates";
import type { Role } from "@/lib/roles";
import type { CustomerRate } from "@/lib/customerRates";

type Props =
  | {
      mode: "edit";
      customerId: string;
      onError: (msg: string) => void;
    }
  | {
      mode: "create";
      pendingRates: { roleId: string; roleName: string; ratePerHour: number }[];
      onAddRate: (roleId: string, roleName: string, ratePerHour: number) => void;
      onRemoveRate: (roleId: string) => void;
      onError: (msg: string) => void;
    };

export function CustomerRatesTab(props: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [rates, setRates] = useState<CustomerRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [newRate, setNewRate] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
    if (props.mode === "edit") {
      let cancelled = false;
      setLoading(true);
      getCustomerRates(props.customerId)
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
    } else {
      setLoading(false);
    }
  }, [props.mode, props.mode === "edit" ? props.customerId : null]);

  const getRoleName = (roleId: string) =>
    roles.find((r) => r.id === roleId)?.name ?? "Unknown";

  const usedRoleIds =
    props.mode === "edit"
      ? rates.map((r) => r.role_id)
      : props.pendingRates.map((r) => r.roleId);
  const availableRoles = roles.filter((r) => !usedRoleIds.includes(r.id));

  const handleAddEdit = async () => {
    const roleId = selectedRoleId;
    const rateNum = parseFloat(newRate);
    if (!roleId || isNaN(rateNum) || rateNum < 0) {
      props.onError("Select a role and enter a valid rate");
      return;
    }
    if (props.mode === "edit") {
      try {
        await createCustomerRate(props.customerId, roleId, rateNum);
        const updated = await getCustomerRates(props.customerId);
        setRates(updated);
        setSelectedRoleId("");
        setNewRate("");
      } catch (e) {
        props.onError(e instanceof Error ? e.message : "Failed to add rate");
      }
    } else {
      const role = roles.find((r) => r.id === roleId);
      if (!role) return;
      props.onAddRate(roleId, role.name, rateNum);
      setSelectedRoleId("");
      setNewRate("");
    }
  };

  const [editingValue, setEditingValue] = useState<Record<string, string>>({});

  const handleUpdateEdit = async (rate: CustomerRate, newVal: number) => {
    if (props.mode !== "edit") return;
    if (newVal === rate.rate_per_hour) return;
    setUpdatingId(rate.id);
    try {
      await updateCustomerRate(rate.id, newVal);
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
      props.onError(e instanceof Error ? e.message : "Failed to update rate");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemoveEdit = async (rate: CustomerRate) => {
    if (props.mode !== "edit") return;
    try {
      await deleteCustomerRate(rate.id);
      setRates((prev) => prev.filter((r) => r.id !== rate.id));
    } catch (e) {
      props.onError(e instanceof Error ? e.message : "Failed to remove rate");
    }
  };

  const displayRates =
    props.mode === "edit"
      ? rates
      : props.pendingRates.map((r) => ({
          id: r.roleId,
          role_id: r.roleId,
          role_name: r.roleName,
          rate_per_hour: r.ratePerHour,
        }));

  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-text-primary opacity-70">
        Set hourly rate per role for this customer. If no rate is specified, the
        standard rate will be used.
      </p>

      {loading ? (
        <p className="text-sm text-text-primary opacity-60">Loading rates…</p>
      ) : (
        <>
          <ul className="space-y-2">
            {displayRates.map((r) => (
              <li
                key={props.mode === "edit" ? (r as CustomerRate).id : r.role_id}
                className="flex items-center gap-3 rounded-lg border border-border bg-bg-default px-3 py-2"
              >
                <span className="flex-1 text-sm font-medium text-text-primary">
                  {props.mode === "edit"
                    ? getRoleName((r as CustomerRate).role_id)
                    : (r as { role_name: string }).role_name}
                </span>
                {props.mode === "edit" ? (
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={
                      (r as CustomerRate).id in editingValue
                        ? editingValue[(r as CustomerRate).id]
                        : String((r as CustomerRate).rate_per_hour)
                    }
                    onChange={(e) =>
                      setEditingValue((prev) => ({
                        ...prev,
                        [(r as CustomerRate).id]: e.target.value,
                      }))
                    }
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (
                        !isNaN(val) &&
                        val >= 0 &&
                        val !== (r as CustomerRate).rate_per_hour
                      ) {
                        handleUpdateEdit(r as CustomerRate, val);
                      }
                    }}
                    disabled={updatingId === (r as CustomerRate).id}
                    className="w-24 rounded-lg border border-border bg-bg-default px-3 py-2 text-right text-sm text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-2 focus:ring-brand-signal focus:ring-offset-2 disabled:opacity-50"
                  />
                ) : (
                  <span className="text-sm text-text-primary opacity-70">
                    {(r as { rate_per_hour: number }).rate_per_hour} SEK/h
                  </span>
                )}
                <span className="text-xs text-text-primary opacity-60">SEK/h</span>
                <button
                  type="button"
                  onClick={() =>
                    props.mode === "edit"
                      ? handleRemoveEdit(r as CustomerRate)
                      : props.onRemoveRate(r.role_id)
                  }
                  className="rounded p-1.5 text-text-primary opacity-60 hover:bg-danger/10 hover:text-danger"
                  aria-label="Remove rate"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          {availableRoles.length > 0 && (
            <div className="flex flex-nowrap items-end gap-3 border-t border-border pt-4">
              <Select
                id="rate-role"
                label="Role"
                value={selectedRoleId}
                onValueChange={setSelectedRoleId}
                placeholder="Select role"
                options={availableRoles.map((r) => ({
                  value: r.id,
                  label: r.name,
                }))}
                size="md"
                className="w-40 shrink-0"
                triggerClassName="h-10"
              />
              <div className="w-24 shrink-0">
                <Input
                  id="rate-value"
                  label="Hourly rate (SEK)"
                  type="number"
                  min={0}
                  step={1}
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  placeholder="0"
                  className="h-10"
                />
              </div>
              <Button
                type="button"
                onClick={handleAddEdit}
                className="h-10 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          )}

          {roles.length === 0 && (
            <p className="text-sm text-text-primary opacity-60">
              No roles found. Add roles first to set customer rates.
            </p>
          )}
        </>
      )}
    </div>
  );
}
