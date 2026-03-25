/** Stable key for optimistic allocation cell updates and lookups. */
export function allocationCellKey(
  consultantId: string,
  projectId: string,
  roleId: string | null,
  year: number,
  week: number
): string {
  return `${consultantId}|${projectId}|${roleId ?? ""}|${year}|${week}`;
}
