"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import {
  IconButton,
  InlineEditFieldContainer,
  InlineEditStatus,
  SAVED_DURATION_MS,
} from "@/components/ui";
import { editInputClass, inlineEditTriggerClass } from "@/components/ui";
import { getRoles } from "@/lib/roles";
import {
  getProjectRates,
  updateProjectRate,
  deleteProjectRate,
} from "@/lib/projectRates";
import { isInlineEditValueChanged } from "@/lib/inlineEdit";
import type { Role } from "@/lib/roles";
import type { ProjectRate } from "@/lib/projectRates";

type Props = {
  projectId: string;
  onError: (msg: string) => void;
  showDescription?: boolean;
  /** When this value changes, rates are refetched (e.g. after adding a new rate). */
  refreshTrigger?: number;
};

export function ProjectRatesTab({
  projectId,
  onError,
  showDescription = false,
  refreshTrigger,
}: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [rates, setRates] = useState<ProjectRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const originalValueRef = useRef("");
  const [rateError, setRateError] = useState<string | null>(null);
  const [showSavedRate, setShowSavedRate] = useState(false);
  const lastSavedRateIdRef = useRef<string | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, [projectId, refreshTrigger]);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const getRoleName = (roleId: string) =>
    roles.find((r) => r.id === roleId)?.name ?? "Unknown";

  const handleUpdate = async (rate: ProjectRate, newVal: number) => {
    if (newVal === rate.rate_per_hour) return;
    setRateError(null);
    const previousVal = rate.rate_per_hour;
    setRates((prev) =>
      prev.map((r) =>
        r.id === rate.id ? { ...r, rate_per_hour: newVal } : r
      )
    );
    setEditingRateId(null);
    lastSavedRateIdRef.current = rate.id;
    setShowSavedRate(true);
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = setTimeout(() => {
      savedTimeoutRef.current = null;
      setShowSavedRate(false);
      lastSavedRateIdRef.current = null;
    }, SAVED_DURATION_MS);
    setUpdatingId(rate.id);
    try {
      await updateProjectRate(rate.id, newVal);
    } catch (e) {
      setRateError(e instanceof Error ? e.message : "Failed to update rate");
      setShowSavedRate(false);
      lastSavedRateIdRef.current = null;
      setRates((prev) =>
        prev.map((r) =>
          r.id === rate.id ? { ...r, rate_per_hour: previousVal } : r
        )
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const startEdit = (rate: ProjectRate) => {
    setRateError(null);
    originalValueRef.current = String(rate.rate_per_hour);
    setEditValue(originalValueRef.current);
    setEditingRateId(rate.id);
  };

  const cancelEdit = () => {
    setEditingRateId(null);
    setRateError(null);
  };

  const commitEdit = (rate: ProjectRate) => {
    if (editingRateId !== rate.id) return;
    const trimmed = editValue.trim();
    if (trimmed === "") {
      setEditingRateId(null);
      return;
    }
    const num = parseFloat(trimmed.replace(",", "."));
    if (isNaN(num) || num < 0) {
      setRateError("Enter a valid number");
      return;
    }
    if (!isInlineEditValueChanged(originalValueRef.current, trimmed)) {
      setEditingRateId(null);
      return;
    }
    handleUpdate(rate, num);
  };

  const handleRemove = async (rate: ProjectRate) => {
    if (editingRateId === rate.id) {
      setEditingRateId(null);
      setRateError(null);
    }
    try {
      await deleteProjectRate(rate.id);
      setRates((prev) => prev.filter((r) => r.id !== rate.id));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to remove rate");
    }
  };

  const rateStatus = (rateId: string) =>
    updatingId === rateId
      ? "saving"
      : showSavedRate && lastSavedRateIdRef.current === rateId
        ? "saved"
        : rateError
          ? "error"
          : "idle";

  return (
    <div className="space-y-2">
      {loading ? (
        <p className="text-sm text-text-primary opacity-60">Loading rates…</p>
      ) : (
        <>
          <ul className="space-y-1">
            {rates.map((r) => {
              const isEdit = editingRateId === r.id;
              return (
                <li
                  key={r.id}
                  className="flex min-w-0 flex-nowrap items-center gap-3 rounded-md bg-bg-muted/20 px-2 py-1"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                    {getRoleName(r.role_id)}
                  </span>
                  <div className="min-w-[5.5rem] shrink-0">
                    <InlineEditFieldContainer
                      isEditing={isEdit}
                      onRequestClose={() => commitEdit(r)}
                      showSavedIndicator={showSavedRate && lastSavedRateIdRef.current === r.id}
                      reserveStatusRow={false}
                      displayContent={
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          className={`${inlineEditTriggerClass} w-full min-w-[5rem] whitespace-nowrap text-right`}
                        >
                          <span className="text-sm font-medium text-text-primary">{r.rate_per_hour} SEK/h</span>
                        </button>
                      }
                      editContent={
                        <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => commitEdit(r)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitEdit(r);
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEdit();
                              }
                            }}
                            disabled={updatingId === r.id}
                            className={`w-20 text-right ${editInputClass}`}
                            autoFocus
                          />
                          <span className="shrink-0 text-sm text-text-primary opacity-70">SEK/h</span>
                        </div>
                      }
                      statusContent={
                        <InlineEditStatus
                          status={rateStatus(r.id)}
                          message={rateError}
                        />
                      }
                    />
                  </div>
                  <IconButton
                    variant="ghostDanger"
                    onClick={() => handleRemove(r)}
                    aria-label="Remove rate"
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </li>
              );
            })}
          </ul>

        </>
      )}
    </div>
  );
}
