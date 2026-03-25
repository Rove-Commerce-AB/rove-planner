import { useMemo } from "react";
import type { AllocationPageData } from "@/lib/allocationPageTypes";

export function useAllocationFilteredData(
  data: AllocationPageData | null,
  teamFilterId: string | null,
  defaultRoleFilterId: string | null
): AllocationPageData | null {
  return useMemo(() => {
    if (data === null) return null;
    return {
      consultants: data.consultants.filter((c) => {
        if (teamFilterId !== null && c.teamId !== teamFilterId) return false;
        if (defaultRoleFilterId !== null && c.defaultRoleId !== defaultRoleFilterId)
          return false;
        return true;
      }),
      projects: data.projects ?? [],
      customers: data.customers ?? [],
      roles: data.roles ?? [],
      teams: data.teams ?? [],
      allocations: data.allocations ?? [],
      year: data.year,
      weekFrom: data.weekFrom,
      weekTo: data.weekTo,
      weeks: data.weeks ?? [],
    };
  }, [data, teamFilterId, defaultRoleFilterId]);
}
