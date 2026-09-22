import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import {
  ALLOCATION_WEEK_PAGE,
  ALLOCATION_WEEK_STEP,
} from "@/lib/hooks/useAllocationWeekNavigation";

type Props = {
  onShift: (weeks: number) => void;
  getUrl?: (weeks: number) => string;
  prefetch?: (url: string) => void;
  disabled?: boolean;
  onJumpToCurrentWeek?: () => void;
  currentWeekInView?: boolean;
  getCurrentWeekUrl?: () => string;
};

const buttonClass =
  "rounded-sm p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100 disabled:pointer-events-none disabled:opacity-50";

export function AllocationWeekNav({
  onShift,
  getUrl,
  prefetch,
  disabled = false,
  onJumpToCurrentWeek,
  currentWeekInView = false,
  getCurrentWeekUrl,
}: Props) {
  function navButton(weeks: number, label: string, icon: ReactNode) {
    return (
      <button
        type="button"
        onClick={() => onShift(weeks)}
        disabled={disabled}
        onMouseEnter={() => {
          if (getUrl && prefetch) prefetch(getUrl(weeks));
        }}
        className={buttonClass}
        aria-label={label}
        title={label}
      >
        {icon}
      </button>
    );
  }

  return (
    <div className="flex items-center">
      {navButton(
        -ALLOCATION_WEEK_PAGE,
        "Previous 5 weeks",
        <ChevronsLeft className="h-3.5 w-3.5" />
      )}
      {navButton(
        -ALLOCATION_WEEK_STEP,
        "Previous week",
        <ChevronLeft className="h-3.5 w-3.5" />
      )}
      {onJumpToCurrentWeek ? (
        <button
          type="button"
          onClick={onJumpToCurrentWeek}
          disabled={disabled || currentWeekInView}
          onMouseEnter={() => {
            if (getCurrentWeekUrl && prefetch && !currentWeekInView) {
              prefetch(getCurrentWeekUrl());
            }
          }}
          className="mx-0.5 rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-text-primary hover:bg-bg-muted disabled:pointer-events-none disabled:opacity-40"
          aria-label={
            currentWeekInView ? "Current week is in view" : "Jump to current week"
          }
          title={
            currentWeekInView ? "Current week is in view" : "Jump to current week"
          }
        >
          This week
        </button>
      ) : null}
      {navButton(
        ALLOCATION_WEEK_STEP,
        "Next week",
        <ChevronRight className="h-3.5 w-3.5" />
      )}
      {navButton(
        ALLOCATION_WEEK_PAGE,
        "Next 5 weeks",
        <ChevronsRight className="h-3.5 w-3.5" />
      )}
    </div>
  );
}
