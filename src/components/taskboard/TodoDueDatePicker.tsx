"use client";

import { useRef } from "react";
import { Calendar, X } from "lucide-react";
import { formatTodoDueDateLabel } from "@/lib/taskBoardDueDate";
import { IconButton } from "@/components/ui/IconButton";

type Props = {
  value: string;
  onValueChange: (isoYYYYMMDD: string | null) => void;
  disabled?: boolean;
  pastDue?: boolean;
  /** Accessible name for the date control (opens native picker). */
  ariaLabel: string;
  /** Show formatted date beside the icon when a date is set. */
  showLabel?: boolean;
};

export function TodoDueDatePicker({
  value,
  onValueChange,
  disabled = false,
  pastDue = false,
  ariaLabel,
  showLabel = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const borderClass = pastDue ? "border-danger" : "border-form";
  const iconClass = pastDue ? "text-danger" : "text-text-muted";
  const dueTooltip = value
    ? pastDue
      ? `Overdue: ${formatTodoDueDateLabel(value)}`
      : `Due date: ${formatTodoDueDateLabel(value)}`
    : "Set due date";

  const valueLabel = value ? formatTodoDueDateLabel(value) : "";
  const announceLabel =
    value && valueLabel ? `${ariaLabel}, ${valueLabel}` : ariaLabel;

  function openPicker() {
    if (disabled) return;
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        /* ignore — fall back to click() */
      }
    }
    el.click();
  }

  return (
    <div
      className={`inline-flex max-w-full items-center gap-1 rounded-md border bg-bg-default px-0.5 py-0.5 ${borderClass}`}
    >
      {/* Off-screen: avoids Chromium’s localized hover tooltip on the native date control (“Visa datumväljaren”, etc.). */}
      <input
        ref={inputRef}
        type="date"
        lang="en"
        disabled={disabled}
        value={value}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const v = e.target.value;
          onValueChange(v === "" ? null : v);
        }}
        className="sr-only"
      />
      <button
        type="button"
        title={disabled ? undefined : dueTooltip}
        aria-label={announceLabel}
        disabled={disabled}
        onClick={openPicker}
        className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-bg-muted ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
      >
        <Calendar className={`h-4 w-4 ${iconClass}`} aria-hidden />
      </button>
      {showLabel && value ? (
        <span
          title={disabled ? undefined : dueTooltip}
          className={`min-w-0 max-w-[6.5rem] truncate text-xs tabular-nums ${
            pastDue ? "font-medium text-danger" : "text-text-primary/85"
          }`}
        >
          {formatTodoDueDateLabel(value)}
        </span>
      ) : null}
      {value && !disabled ? (
        <IconButton
          type="button"
          variant="ghost"
          aria-label="Clear due date"
          className="z-[2] shrink-0 p-1"
          onClick={(e) => {
            e.preventDefault();
            onValueChange(null);
          }}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      ) : null}
    </div>
  );
}
