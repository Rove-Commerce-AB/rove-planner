import type { WorkIssue, WorkPerson } from "@/lib/workTypes";

export const UNASSIGNED_OWNER_ID = "unassigned";
export const NO_LABEL_ID = "no-label";

export type WorkBoardGroupBy = "none" | "owner" | "label";

export type WorkColumnGroup = {
  key: string;
  title: string;
  owner: WorkPerson | null;
  issues: WorkIssue[];
};

export function ownerFilterKey(issue: WorkIssue): string {
  return issue.owner?.id ?? UNASSIGNED_OWNER_ID;
}

export function issueMatchesOwnerFilter(
  issue: WorkIssue,
  ownerFilterIds: readonly string[]
): boolean {
  if (ownerFilterIds.length === 0) return true;
  return ownerFilterIds.includes(ownerFilterKey(issue));
}

export function collectOwnerFilterPeople(
  people: WorkPerson[],
  issues: WorkIssue[]
): WorkPerson[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  for (const issue of issues) {
    if (issue.owner && !byId.has(issue.owner.id)) {
      byId.set(issue.owner.id, issue.owner);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function visibleWorkIssueIds(
  issues: WorkIssue[],
  search: string,
  ownerFilterIds: readonly string[]
): Set<string> {
  const query = search.trim().toLowerCase();
  return new Set(
    issues
      .filter((issue) => {
        if (!issueMatchesOwnerFilter(issue, ownerFilterIds)) return false;
        if (!query) return true;
        return (
          issue.title.toLowerCase().includes(query) ||
          issue.key.toLowerCase().includes(query)
        );
      })
      .map((issue) => issue.id)
  );
}

function sortNamedGroups(groups: WorkColumnGroup[], emptyKey: string) {
  return groups.sort((a, b) => {
    if (a.key === emptyKey) return 1;
    if (b.key === emptyKey) return -1;
    return a.title.localeCompare(b.title);
  });
}

export function groupIssuesByOwner(issues: WorkIssue[]): WorkColumnGroup[] {
  const groups = new Map<string, WorkColumnGroup>();
  for (const issue of issues) {
    const key = ownerFilterKey(issue);
    const current = groups.get(key);
    if (current) {
      current.issues.push(issue);
      continue;
    }
    groups.set(key, {
      key,
      title: issue.owner?.name ?? "Unassigned",
      owner: issue.owner,
      issues: [issue],
    });
  }
  return sortNamedGroups([...groups.values()], UNASSIGNED_OWNER_ID);
}

export function groupIssuesByLabel(issues: WorkIssue[]): WorkColumnGroup[] {
  const groups = new Map<string, WorkColumnGroup>();
  function add(key: string, title: string, issue: WorkIssue) {
    const current = groups.get(key);
    if (current) {
      current.issues.push(issue);
      return;
    }
    groups.set(key, { key, title, owner: null, issues: [issue] });
  }
  for (const issue of issues) {
    if (issue.labels.length === 0) {
      add(NO_LABEL_ID, "No labels", issue);
      continue;
    }
    for (const label of issue.labels) {
      add(label.id, label.name, issue);
    }
  }
  return sortNamedGroups([...groups.values()], NO_LABEL_ID);
}

export function columnIssueGroups(
  issues: WorkIssue[],
  groupBy: WorkBoardGroupBy
): WorkColumnGroup[] {
  if (groupBy === "owner") return groupIssuesByOwner(issues);
  if (groupBy === "label") return groupIssuesByLabel(issues);
  return [{ key: "all", title: "", owner: null, issues }];
}

export function groupByTriggerLabel(groupBy: WorkBoardGroupBy): string {
  if (groupBy === "owner") return "Owner";
  if (groupBy === "label") return "Label";
  return "Group";
}
