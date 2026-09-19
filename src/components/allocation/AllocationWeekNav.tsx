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
};

const buttonClass =
  "rounded-sm p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100 disabled:pointer-events-none disabled:opacity-50";

export function AllocationWeekNav({
  onShift,
  getUrl,
  prefetch,
  disabled = false,
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
