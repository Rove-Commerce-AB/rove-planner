import type { AllocationConsultant, AllocationPageData } from "./allocationPageTypes";

export function consultantMatchesAllocationFilters(
  consultant: AllocationConsultant,
  teamFilterId: string | null,
  defaultRoleFilterId: string | null,
  defaultVisibleConsultantIds?: string[] | null
): boolean {
  if (teamFilterId !== null) {
    if (consultant.teamId !== teamFilterId) return false;
  } else if (
    defaultVisibleConsultantIds != null &&
    !defaultVisibleConsultantIds.includes(consultant.id)
  ) {
    return false;
  }
  if (
    defaultRoleFilterId !== null &&
    consultant.defaultRoleId !== defaultRoleFilterId
  ) {
    return false;
  }
  return true;
}

/** Apply team / role / project-planning visibility filters to allocation page data. */
export function filterAllocationPageData(
  data: AllocationPageData,
  teamFilterId: string | null,
  defaultRoleFilterId: string | null
): AllocationPageData {
  return {
    ...data,
    consultants: data.consultants.filter((c) =>
      consultantMatchesAllocationFilters(
        c,
        teamFilterId,
        defaultRoleFilterId,
        data.defaultVisibleConsultantIds
      )
    ),
  };
}
