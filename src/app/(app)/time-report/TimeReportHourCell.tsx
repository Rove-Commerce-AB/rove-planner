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
}: {
  value: number;
  entryId: string;
  dayIndex: number;
  isEditing: boolean;
  onStartEdit: () => void;
  onCommit: (v: number) => void;
  onBlur: () => void;
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
        className="h-6 w-9 rounded border border-form bg-bg-default px-0.5 text-right text-xs tabular-nums text-text-primary focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    );
  }

  const display = value === 0 ? "" : String(value);
  return (
    <span className="inline-flex h-6 shrink-0 items-center text-xs tabular-nums text-text-primary">
      {display}
    </span>
  );
}
