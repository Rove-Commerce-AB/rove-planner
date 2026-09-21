export function assignmentSelectionState(
  ids: readonly string[],
  selectedIds: readonly string[]
): { allSelected: boolean; noneSelected: boolean } {
  const selected = new Set(selectedIds);
  return {
    allSelected: ids.length > 0 && ids.every((id) => selected.has(id)),
    noneSelected: ids.every((id) => !selected.has(id)),
  };
}
