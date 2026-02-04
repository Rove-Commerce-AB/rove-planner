"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCirclePlus, X } from "lucide-react";
import { createFeatureRequest } from "@/lib/featureRequests";

export function FeatureRequestFab() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    setError(null);
    setSubmitting(true);
    try {
      await createFeatureRequest(trimmed);
      setMessage("");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open ? (
        <div
          className="w-80 rounded-lg border border-border bg-bg-default p-4 shadow-lg"
          style={{ borderColor: "var(--panel-border)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-text-primary">
              Feature request
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your idea or improvement..."
              rows={3}
              className="w-full rounded-lg border border-border bg-bg-default px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-2 focus:ring-brand-signal"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border bg-bg-default px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-brand-signal px-3 py-1.5 text-sm font-medium text-text-inverse hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-signal text-text-inverse shadow-lg transition-opacity hover:opacity-90"
          aria-label="Send feature request"
          title="Feature request"
        >
          <MessageCirclePlus className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
