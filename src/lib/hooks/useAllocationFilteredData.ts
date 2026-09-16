import { useMemo } from "react";
import { filterAllocationPageData } from "@/lib/allocationPageFilter";
import type { AllocationPageData } from "@/lib/allocationPageTypes";

export function useAllocationFilteredData(
  data: AllocationPageData | null,
  teamFilterId: string | null,
  defaultRoleFilterId: string | null
): AllocationPageData | null {
  return useMemo(() => {
    if (data === null) return null;
    return filterAllocationPageData(data, teamFilterId, defaultRoleFilterId);
  }, [data, teamFilterId, defaultRoleFilterId]);
}
