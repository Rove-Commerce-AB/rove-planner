"use client";

import { useEffect, useState } from "react";

/** Inline-edit cell for one day: display value or input on edit. */
export function TimeReportHourCell({
  value,
  isEditing,
  onCommit,
  onBlur,
  entryId: _entryId,
  dayIndex: _dayIndex,
  onStartEdit: _onStartEdit,
  compact = false,
}: {
  value: number;
  entryId: string;
  dayIndex: number;
  isEditing: boolean;
  onStartEdit: () => void;
  onCommit: (v: number) => void;
  onBlur: () => void;
  /** Narrow cells for month grid. */
  compact?: boolean;
}) {
  const [localValue, setLocalValue] = useState(String(value || ""));

  useEffect(() => {
    if (isEditing) setLocalValue(value === 0 ? "" : String(value));
  }, [isEditing, value]);

  const handleCommit = () => {
    const num =
      localValue === "" ? 0 : Math.max(0, Math.min(24, parseFloat(localValue) || 0));
    onCommit(num);
    setLocalValue(num === 0 ? "" : String(num));
    onBlur();
  };

  if (isEditing) {
    return (
      <input
        type="number"
        min={0}
        max={24}
        step={0.5}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCommit();
          if (e.key === "Escape") {
            setLocalValue(value === 0 ? "" : String(value));
            onBlur();
          }
        }}
        autoFocus
        className={`rounded border border-form bg-bg-default px-0.5 text-right tabular-nums text-text-primary focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
          compact ? "h-5 w-full min-w-0 max-w-full text-[9px]" : "h-6 w-9 text-xs"
        }`}
      />
    );
  }

  const display = value === 0 ? "" : String(value);
  return (
    <span
      className={`inline-flex min-w-0 max-w-full items-center justify-center tabular-nums text-text-primary ${
        compact ? "h-5 w-full text-[9px]" : "h-6 shrink-0 text-xs"
      }`}
    >
      {display}
    </span>
  );
}
