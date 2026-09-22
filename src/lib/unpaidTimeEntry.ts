/**
 * Time described as "(unpaid)" is a billing kind, not billable work.
 * The same marker is stored as time_report_entries.billing_kind (see
 * scripts/20260922_time_report_billing_kind.sql). Keep the SQL expression
 * in unpaidTimeEntrySql aligned with that generated column.
 */

const UNPAID_MARKER = /\(\s*unpaid\s*\)/i;

export function textMarksUnpaid(text: string | null | undefined): boolean {
  return UNPAID_MARKER.test(text ?? "");
}

/** True when the task description or the day's internal comment contains (unpaid). */
export function isUnpaidTimeEntry(
  description: string | null | undefined,
  internalComment?: string | null
): boolean {
  return textMarksUnpaid(description) || textMarksUnpaid(internalComment);
}

/** Hours that count in monthly invoice totals. Unpaid cells contribute 0. */
export function billableReportedHours(
  hours: number,
  description: string | null | undefined,
  internalComment?: string | null
): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  if (isUnpaidTimeEntry(description, internalComment)) return 0;
  return hours;
}

/** Postgres boolean. `alias` qualifies description and internal_comment. */
export function unpaidTimeEntrySql(alias?: string): string {
  if (alias != null && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) {
    throw new Error("Invalid SQL alias");
  }
  const col = (name: string) => (alias ? `${alias}.${name}` : name);
  return `(COALESCE(${col("description")}, '') ~* '\\(\\s*unpaid\\s*\\)' OR COALESCE(${col("internal_comment")}, '') ~* '\\(\\s*unpaid\\s*\\)')`;
}
