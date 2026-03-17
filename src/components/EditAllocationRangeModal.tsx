"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { createAllocation, updateAllocation } from "@/lib/allocations";
import {
  revalidateAllocationPage,
  logAllocationHistoryCreate,
  logAllocationHistoryUpdate,
  deleteAllocationWithHistory,
} from "@/app/(app)/allocation/actions";
import { useEscToClose } from "@/lib/useEscToClose";
import { Button, modalFocusClass } from "@/components/ui";
import { TO_PLAN_CONSULTANT_ID } from "@/lib/allocationPage";

export type EditAllocationRangeWeek = {
  year: number;
  week: number;
  allocationId: string | null;
  currentHours: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Single number = same hours for all weeks (hours mode). Array = per-week hours (percent mode). */
  onSuccess: (savedHours: number | { year: number; week: number; hours: number }[]) => void;
  consultantId: string;
  consultantName: string;
  projectId: string;
  projectLabel: string;
  roleId: string | null;
  roleName?: string;
  weeks: EditAllocationRangeWeek[];
  availableHoursByWeek: number[];
};

export function EditAllocationRangeModal({
  isOpen,
  onClose,
  onSuccess,
  consultantId,
  consultantName,
  projectId,
  projectLabel,
  roleId,
  roleName,
  weeks,
  availableHoursByWeek,
}: Props) {
  const [inputMode, setInputMode] = useState<"hours" | "percent">("hours");
  const [hoursStr, setHoursStr] = useState("");
  const [percentStr, setPercentStr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const firstAvailable = availableHoursByWeek[0] ?? 0;

  useEffect(() => {
    if (isOpen && weeks.length > 0) {
      const first = weeks[0];
      const h = first.currentHours;
      setHoursStr(String(h));
      setPercentStr(
        firstAvailable > 0 ? String(Math.round((h / firstAvailable) * 100)) : ""
      );
      setError(null);
    }
  }, [isOpen, weeks, firstAvailable]);

  const hoursFromInput = (): number => {
    if (inputMode === "hours") {
      const h = parseFloat(hoursStr.replace(",", "."));
      return Number.isNaN(h) || h < 0 ? -1 : h;
    }
    const p = parseFloat(percentStr.replace(",", "."));
    if (Number.isNaN(p) || p < 0 || p > 100) return -1;
    if (firstAvailable <= 0) return 0;
    return (p / 100) * firstAvailable;
  };

  const displayPercent = (): string => {
    const h = parseFloat(hoursStr.replace(",", "."));
    if (Number.isNaN(h) || h < 0 || firstAvailable <= 0) return "—";
    return String(Math.round((h / firstAvailable) * 100));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const consultantIdOrNull =
      consultantId === TO_PLAN_CONSULTANT_ID ? null : consultantId;

    if (inputMode === "hours") {
      const hours = hoursFromInput();
      if (hours < 0) {
        setError("Enter a valid number of hours (≥ 0).");
        return;
      }
      setError(null);
      setSubmitting(true);
      try {
        const promises = weeks.map(async (w) => {
          if (hours === 0) {
            if (w.allocationId) {
              await deleteAllocationWithHistory(w.allocationId);
            }
          } else {
            if (w.allocationId) {
              await updateAllocation(w.allocationId, { hours });
              await logAllocationHistoryUpdate(w.allocationId, hours);
            } else {
              const created = await createAllocation({
                consultant_id: consultantIdOrNull,
                project_id: projectId,
                role_id: roleId ?? undefined,
                year: w.year,
                week: w.week,
                hours,
              });
              await logAllocationHistoryCreate(created.id);
            }
          }
        });
        await Promise.all(promises);
        await revalidateAllocationPage();
        onSuccess(hours);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const p = parseFloat(percentStr.replace(",", "."));
    if (Number.isNaN(p) || p < 0 || p > 100) {
      setError("Enter a valid percent (0–100).");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const hoursPerWeek = weeks.map((w, i) => {
        const available = availableHoursByWeek[i] ?? 0;
        return (p / 100) * available;
      });
      const promises = weeks.map(async (w, i) => {
        const hours = hoursPerWeek[i] ?? 0;
        if (hours === 0) {
          if (w.allocationId) {
            await deleteAllocationWithHistory(w.allocationId);
          }
        } else {
          if (w.allocationId) {
            await updateAllocation(w.allocationId, { hours });
            await logAllocationHistoryUpdate(w.allocationId, hours);
          } else {
            const created = await createAllocation({
              consultant_id: consultantIdOrNull,
              project_id: projectId,
              role_id: roleId ?? undefined,
              year: w.year,
              week: w.week,
              hours,
            });
            await logAllocationHistoryCreate(created.id);
          }
        }
      });
      await Promise.all(promises);
      await revalidateAllocationPage();
      onSuccess(
        weeks.map((w, i) => ({ year: w.year, week: w.week, hours: hoursPerWeek[i] ?? 0 }))
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  useEscToClose(isOpen, handleClose);

  if (!isOpen || weeks.length === 0) return null;

  const weekRangeLabel =
    weeks.length === 1
      ? `v${weeks[0].week}, ${weeks[0].year}`
      : weeks[0].year !== weeks[weeks.length - 1].year
        ? `v${weeks[0].week} ${weeks[0].year} – v${weeks[weeks.length - 1].week} ${weeks[weeks.length - 1].year}`
        : `v${weeks[0].week}–v${weeks[weeks.length - 1].week}, ${weeks[0].year}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-lg bg-bg-default p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-allocation-range-title"
      >
        <div className="flex items-center justify-between">
          <h2
            id="edit-allocation-range-title"
            className="text-lg font-semibold text-text-primary"
          >
            Edit allocation
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-sm p-1 text-text-primary opacity-60 hover:bg-bg-muted hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-discreet mt-6 space-y-4">
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary">
              Consultant
            </label>
            <p className="mt-1 text-text-primary">{consultantName}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary">
              Project
            </label>
            <p className="mt-1 text-text-primary">{projectLabel}</p>
          </div>

          {roleName != null && roleName !== "" && (
            <div>
              <label className="block text-sm font-medium text-text-primary">
                Role
              </label>
              <p className="mt-1 text-text-primary">{roleName}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary">
              Weeks
            </label>
            <p className="mt-1 text-text-primary">{weekRangeLabel}</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setInputMode("hours")}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                inputMode === "hours"
                  ? "border-brand-signal bg-brand-signal/20 text-text-primary"
                  : "border-form bg-bg-default text-text-primary hover:bg-bg-muted"
              }`}
            >
              Hours
            </button>
            <button
              type="button"
              onClick={() => setInputMode("percent")}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                inputMode === "percent"
                  ? "border-brand-signal bg-brand-signal/20 text-text-primary"
                  : "border-form bg-bg-default text-text-primary hover:bg-bg-muted"
              }`}
            >
              %
            </button>
          </div>

          {inputMode === "hours" ? (
            <div>
              <label
                htmlFor="edit-range-hours"
                className="block text-sm font-medium text-text-primary"
              >
                Hours per week
              </label>
              <input
                id="edit-range-hours"
                type="number"
                min={0}
                step={0.5}
                value={hoursStr}
                onChange={(e) => setHoursStr(e.target.value)}
                onFocus={(e) => e.target.select()}
                className={`mt-1 w-24 rounded-lg border border-form bg-bg-default px-3 py-2 text-sm text-text-primary ${modalFocusClass}`}
              />
              {firstAvailable > 0 && (
                <p className="mt-1 text-xs text-text-primary opacity-60">
                  ≈ {displayPercent()}% of capacity (w{weeks[0].week})
                </p>
              )}
            </div>
          ) : (
            <div>
              <label
                htmlFor="edit-range-percent"
                className="block text-sm font-medium text-text-primary"
              >
                Percent of capacity (w{weeks[0].week})
              </label>
              <input
                id="edit-range-percent"
                type="number"
                min={0}
                max={100}
                step={5}
                value={percentStr}
                onChange={(e) => setPercentStr(e.target.value)}
                onFocus={(e) => e.target.select()}
                className={`mt-1 w-24 rounded-lg border border-form bg-bg-default px-3 py-2 text-sm text-text-primary ${modalFocusClass}`}
              />
              {firstAvailable > 0 && percentStr !== "" && !Number.isNaN(parseFloat(percentStr)) && (
                <p className="mt-1 text-xs text-text-primary opacity-60">
                  ≈ {((parseFloat(percentStr.replace(",", ".")) / 100) * firstAvailable).toFixed(1)} h
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-text-primary opacity-60">
            Set 0 to remove allocation in all selected weeks.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
