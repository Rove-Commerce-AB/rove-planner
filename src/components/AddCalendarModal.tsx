"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createCalendar } from "@/lib/calendarsClient";
import { useEscToClose } from "@/lib/useEscToClose";
import { Button, modalInputClass, modalFocusClass } from "@/components/ui";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddCalendarModal({ isOpen, onClose, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [hoursPerWeek, setHoursPerWeek] = useState("40");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Calendar name is required");
      return;
    }
    if (!countryCode.trim()) {
      setError("Country code is required");
      return;
    }
    const hours = parseFloat(hoursPerWeek.replace(",", "."));
    if (isNaN(hours) || hours <= 0) {
      setError("Hours per week must be a positive number");
      return;
    }
    setSubmitting(true);
    try {
      await createCalendar({
        name: name.trim(),
        country_code: countryCode.trim(),
        hours_per_week: hours,
      });
      setName("");
      setCountryCode("");
      setHoursPerWeek("40");
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add calendar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setName("");
    setCountryCode("");
    setHoursPerWeek("40");
    setError(null);
    onClose();
  };

  useEscToClose(isOpen, handleClose);

  if (!isOpen) return null;

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
        aria-labelledby="add-calendar-title"
      >
        <div className="flex items-center justify-between">
          <h2
            id="add-calendar-title"
            className="text-lg font-semibold text-text-primary"
          >
            Add calendar
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-sm p-1 text-text-primary opacity-70 hover:bg-bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="modal-form-discreet mt-6 space-y-4"
        >
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div>
            <label
              htmlFor="calendar-name"
              className="block text-sm font-medium text-text-primary"
            >
              Name
            </label>
            <input
              id="calendar-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sweden"
              className={`mt-1 ${modalInputClass}`}
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="calendar-country"
              className="block text-sm font-medium text-text-primary"
            >
              Country code
            </label>
            <input
              id="calendar-country"
              type="text"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
              placeholder="e.g. SE"
              maxLength={2}
              className={`mt-1 w-24 rounded-lg border border-form bg-bg-default px-3 py-2 text-sm text-text-primary placeholder-text-muted ${modalFocusClass}`}
            />
          </div>

          <div>
            <label
              htmlFor="calendar-hours"
              className="block text-sm font-medium text-text-primary"
            >
              Hours per week
            </label>
            <input
              id="calendar-hours"
              type="text"
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(e.target.value)}
              placeholder="e.g. 40 or 37.5"
              className={`mt-1 w-32 rounded-lg border border-form bg-bg-default px-3 py-2 text-sm text-text-primary placeholder-text-muted ${modalFocusClass}`}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
