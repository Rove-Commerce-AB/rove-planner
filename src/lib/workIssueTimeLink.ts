export const WORK_TIME_LINK_PREFIX = "work:";

export function workIssueLinkKey(issueId: string): string {
  return `${WORK_TIME_LINK_PREFIX}${issueId}`;
}

export function workIssueIdFromLinkKey(
  raw: string | null | undefined
): string | null {
  const value = (raw ?? "").trim();
  if (!value.toLowerCase().startsWith(WORK_TIME_LINK_PREFIX)) return null;
  const id = value.slice(WORK_TIME_LINK_PREFIX.length).trim();
  return id || null;
}

export function collectWorkIssueIdsFromLinkKeys(
  keys: Array<string | null | undefined>
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const id = workIssueIdFromLinkKey(key);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
