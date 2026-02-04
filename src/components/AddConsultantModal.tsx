"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { createConsultantAndRevalidate } from "@/app/(app)/consultants/actions";
import { getRoles } from "@/lib/roles";
import { useEscToClose } from "@/lib/useEscToClose";
import { getCalendars } from "@/lib/calendars";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddConsultantModal({ isOpen, onClose, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [defaultRoleId, setDefaultRoleId] = useState<string | null>(null);
  const [defaultCalendarId, setDefaultCalendarId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      Promise.all([getRoles(), getCalendars()])
        .then(([r, c]) => {
          setDefaultRoleId(r[0]?.id ?? null);
          setDefaultCalendarId(c[0]?.id ?? null);
        })
        .catch(() => {
          setDefaultRoleId(null);
          setDefaultCalendarId(null);
        });
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!defaultRoleId || !defaultCalendarId) {
      setError("Roles and calendars must be configured. Add at least one role and one calendar in Settings.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createConsultantAndRevalidate({
        name: name.trim(),
        role_id: defaultRoleId,
        calendar_id: defaultCalendarId,
      });
      resetForm();
      onClose();
      onSuccess();
      window.location.href = `/consultants/${result.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add consultant");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
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
        aria-labelledby="add-consultant-title"
      >
        <div className="flex items-center justify-between">
          <h2
            id="add-consultant-title"
            className="text-lg font-semibold text-text-primary"
          >
            Add new consultant
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="mt-6 space-y-4"
        >
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div>
            <label
              htmlFor="consultant-name"
              className="block text-sm font-medium text-text-primary"
            >
              Name
            </label>
            <input
              id="consultant-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Anna Andersson"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-border bg-bg-default px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-signal px-4 py-2 text-sm font-medium text-text-inverse hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
