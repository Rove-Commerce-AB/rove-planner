/** Query keys that change with week navigation / viewport width — ignored when matching star state. */
const VOLATILE_QUERY_KEYS = new Set(["year", "from", "to"]);

/**
 * Normalize path + query for storage and comparison.
 * - Ensures leading `/`
 * - Sorts query keys
 * - Drops empty values
 */
export function normalizeShortcutHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return "/";

  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const qIndex = withSlash.indexOf("?");
  const pathname = qIndex === -1 ? withSlash : withSlash.slice(0, qIndex);
  const search = qIndex === -1 ? "" : withSlash.slice(qIndex + 1);

  if (!search) return pathname || "/";

  const params = new URLSearchParams(search);
  const entries = [...params.entries()]
    .filter(([, v]) => v !== "")
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return pathname || "/";

  const next = new URLSearchParams();
  for (const [k, v] of entries) next.append(k, v);
  return `${pathname || "/"}?${next.toString()}`;
}

/**
 * Match key for "is this page starred?" — same path + filters/views,
 * but ignores volatile week-range params so viewport resize does not clear the star.
 */
export function shortcutMatchKey(href: string): string {
  const normalized = normalizeShortcutHref(href);
  const qIndex = normalized.indexOf("?");
  const pathname = qIndex === -1 ? normalized : normalized.slice(0, qIndex);
  const search = qIndex === -1 ? "" : normalized.slice(qIndex + 1);
  if (!search) return pathname;

  const params = new URLSearchParams(search);
  const entries = [...params.entries()]
    .filter(([k, v]) => v !== "" && !VOLATILE_QUERY_KEYS.has(k))
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return pathname;

  const next = new URLSearchParams();
  for (const [k, v] of entries) next.append(k, v);
  return `${pathname}?${next.toString()}`;
}

export function buildCurrentPageHref(pathname: string, search: string): string {
  const q = search.startsWith("?") ? search.slice(1) : search;
  return normalizeShortcutHref(q ? `${pathname}?${q}` : pathname);
}
