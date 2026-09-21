"use client";

import { assignmentSelectionState } from "@/lib/selectAllNone";

type Props = {
  ids: readonly string[];
  selectedIds: readonly string[];
  onSelectedIdsChange: (ids: string[]) => void;
  disabled?: boolean;
};

const actionClassName =
  "cursor-pointer text-label-s text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40";

export function SelectAllNone({
  ids,
  selectedIds,
  onSelectedIdsChange,
  disabled = false,
}: Props) {
  if (ids.length === 0) return null;

  const { allSelected, noneSelected } = assignmentSelectionState(
    ids,
    selectedIds
  );

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        disabled={disabled || allSelected}
        onClick={() => onSelectedIdsChange([...ids])}
        className={actionClassName}
      >
        Select all
      </button>
      <span className="text-label-s text-text-tertiary" aria-hidden>
        ·
      </span>
      <button
        type="button"
        disabled={disabled || noneSelected}
        onClick={() => onSelectedIdsChange([])}
        className={actionClassName}
      >
        Select none
      </button>
    </div>
  );
}
