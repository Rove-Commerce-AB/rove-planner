"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCirclePlus, X } from "lucide-react";
import { createFeatureRequest } from "@/lib/featureRequests";
import type { WorkIssueType } from "@/lib/workTypes";
import { WorkIssueTypePicker } from "@/app/(app)/work/[customerId]/[projectId]/WorkIssueTypeIcon";

export function FeatureRequestFab() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [issueType, setIssueType] = useState<WorkIssueType>("issue");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function close() {
    setOpen(false);
    setError(null);
  }

  function resetForm() {
    setMessage("");
    setIssueType("issue");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    setError(null);
    setSubmitting(true);
    try {
      await createFeatureRequest(trimmed, issueType);
      resetForm();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  const heading =
    issueType === "bug" ? "Bug report" : "Feature request";
  const placeholder =
    issueType === "bug"
      ? "What went wrong? Steps to reproduce help…"
      : "Describe your idea or improvement…";

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open ? (
        <div
          className="w-80 rounded-lg border border-form bg-bg-default p-4 shadow-lg"
          style={{ borderColor: "var(--panel-border)" }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-medium text-text-primary">
              {heading}
            </span>
            <button
              type="button"
              onClick={close}
              className="shrink-0 rounded p-1 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100"
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
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-text-secondary">
                Type
              </span>
              <WorkIssueTypePicker
                value={issueType}
                onChange={setIssueType}
                disabled={submitting}
                name="Request type"
                size="sm"
              />
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="w-full rounded-lg border border-form bg-bg-default px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-2 focus:ring-brand-signal"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg border bg-bg-default px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-muted"
                style={{ borderColor: "var(--color-border-form)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !message.trim()}
                className="rounded-lg bg-brand-signal px-3 py-1.5 text-sm font-medium text-text-inverse transition-colors hover:bg-accent-primary-hover active:bg-accent-primary-active disabled:opacity-50"
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
          className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-signal text-text-inverse shadow-lg transition-colors hover:bg-accent-primary-hover active:bg-accent-primary-active"
          aria-label="Send feature request or bug report"
          title="Feature request"
        >
          <MessageCirclePlus className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
