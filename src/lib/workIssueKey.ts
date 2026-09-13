export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function normalizeWorkBoardPrefix(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidWorkBoardPrefix(prefix: string): boolean {
  return /^[A-Z][A-Z0-9]{1,7}$/.test(prefix);
}

export function suggestWorkBoardPrefix(customerName: string): string {
  const initials = customerName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (initials.length >= 2) return initials.slice(0, 4);
  const compact = customerName.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (compact.length >= 2) return compact.slice(0, 3);
  return "WB";
}

export function workIssueKey(prefix: string, number: number): string {
  return `${prefix}-${number}`;
}

export function workPersonFromUser(row: {
  id: string;
  name: string | null;
  email: string;
}): { id: string; name: string; initials: string } {
  const name = row.name?.trim() || row.email;
  return { id: row.id, name, initials: initialsFromName(name) };
}
