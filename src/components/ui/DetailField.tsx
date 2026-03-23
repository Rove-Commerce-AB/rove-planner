"use client";

import { useRef, useEffect } from "react";
import { Check, AlertCircle } from "lucide-react";
import {
  inlineEditTriggerClass,
  INLINE_EDIT_VALUE_ROW_MIN_H,
  INLINE_EDIT_STATUS_ROW_MIN_H,
} from "./inlineEditStyles";

/** Inline-edit feedback: idle | saving | saved | error. Fixed height to avoid layout shift. */
export type InlineEditStatusState = "idle" | "saving" | "saved" | "error";

type InlineEditStatusProps = {
  status: InlineEditStatusState;
  /** Shown when status === "error" */
  message?: string | null;
};

const SAVED_DURATION_MS = 2000;

/**
 * Fixed-height status strip for inline-edit feedback. Renders below the input when editing.
 * - idle / saving / saved: empty (no text or spinner; saved feedback is the check next to the value).
 * - error: icon + message
 */
export function InlineEditStatus({ status, message }: InlineEditStatusProps) {
  if (status === "idle" || status === "saving" || status === "saved") {
    return <div className={`${INLINE_EDIT_STATUS_ROW_MIN_H} shrink-0`} aria-hidden />;
  }
  return (
    <div
      className={`flex ${INLINE_EDIT_STATUS_ROW_MIN_H} shrink-0 items-center gap-1.5 text-xs`}
      role="alert"
      aria-live="polite"
    >
      {message && (
        <>
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-danger" />
          <span className="text-danger">{message}</span>
        </>
      )}
    </div>
  );
}

/** Small green check shown next to the value after save; fades out. Use with showSavedIndicator or inline in list layouts. */
export function SavedCheckmark() {
  return (
    <Check
      className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400 animate-[savedCheckFade_2s_ease-out]"
      aria-hidden
    />
  );
}

export { SAVED_DURATION_MS };

/**
 * Stable container for inline-edit fields. Prevents layout shift by always
 * reserving space for (1) value row and (2) status row. Use for detail pages.
 * When isEditing and onRequestClose are set, a click outside the container
 * calls onRequestClose (so Select and other editors close without needing to open dropdown first).
 */
type InlineEditFieldContainerProps = {
  isEditing: boolean;
  displayContent: React.ReactNode;
  editContent: React.ReactNode;
  statusContent: React.ReactNode;
  className?: string;
  /** When true, shows a small green check next to the value that fades out (caller clears after SAVED_DURATION_MS). */
  showSavedIndicator?: boolean;
  /** When false, the status row (min-h strip) is not rendered so the value can be vertically centered. Default true. */
  reserveStatusRow?: boolean;
  /** Called when user clicks outside the container while editing (e.g. commit or cancel). */
  onRequestClose?: () => void;
};

export function InlineEditFieldContainer({
  isEditing,
  displayContent,
  editContent,
  statusContent,
  className = "",
  showSavedIndicator = false,
  reserveStatusRow = true,
  onRequestClose,
}: InlineEditFieldContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEditing || !onRequestClose) return;
    const handleMouseDown = (ev: MouseEvent) => {
      const el = containerRef.current;
      const target = ev.target as Node;
      if (!el || el.contains(target)) return;
      // Don’t close when click is inside a dropdown (e.g. Radix Select portal). Otherwise
      // click-outside runs before onValueChange and we commit the old value and the new choice is lost.
      const inDropdown =
        target.nodeType === Node.ELEMENT_NODE &&
        (target as Element).closest?.('[role="listbox"], [role="option"]');
      if (!inDropdown) onRequestClose();
    };
    document.addEventListener("mousedown", handleMouseDown, true);
    return () => document.removeEventListener("mousedown", handleMouseDown, true);
  }, [isEditing, onRequestClose]);

  return (
    <div
      ref={containerRef}
      className={`flex w-full min-w-0 flex-col ${className}`.trim()}
      data-inline-edit-container
    >
      <div
        className={`flex w-full min-w-0 flex-1 items-center gap-2 ${INLINE_EDIT_VALUE_ROW_MIN_H}`}
        data-inline-edit-value-row
      >
        <span className="min-w-0 flex-1">{isEditing ? editContent : displayContent}</span>
        {/* Fixed-width slot so checkmark never causes layout shift */}
        <span className="inline-flex w-6 shrink-0 items-center justify-end" aria-hidden>
          {!isEditing && showSavedIndicator ? <SavedCheckmark /> : null}
        </span>
      </div>
      {reserveStatusRow && (
        <div
          className={`shrink-0 ${INLINE_EDIT_STATUS_ROW_MIN_H}`}
          data-inline-edit-status-row
        >
          {isEditing ? statusContent : <div className={INLINE_EDIT_STATUS_ROW_MIN_H} aria-hidden />}
        </div>
      )}
    </div>
  );
}

type Props = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Label for a field on detail pages (e.g. Company name, Account Manager).
 * Small, uppercase, muted. Use with FieldValue for consistent typography.
 */
export function FieldLabel({ children, className = "" }: Props) {
  return (
    <div
      className={`pl-1 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

/**
 * Value text for a field on detail pages. Semibold, primary color, small size to match label scale.
 */
export function FieldValue({ children, className = "" }: Props) {
  return (
    <span
      className={`text-sm font-semibold text-text-primary ${className}`.trim()}
    >
      {children}
    </span>
  );
}

type InlineEditTriggerProps = {
  onClick: () => void;
  children: React.ReactNode;
  /** Extra classes (e.g. for empty-state text color) */
  className?: string;
};

/**
 * Reusable trigger for inline-editable fields. Shows value and a discrete edit icon on hover.
 * Use for text, number, date, select display states on detail pages.
 */
export function InlineEditTrigger({
  onClick,
  children,
  className = "",
}: InlineEditTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group ${inlineEditTriggerClass} ${className}`.trim()}
    >
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}
