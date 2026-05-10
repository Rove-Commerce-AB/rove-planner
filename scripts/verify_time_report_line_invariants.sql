-- Read-only invariant checks for time report line model.
-- Intended as a release gate before production deploy.

-- A) Day entries with non-positive hours (must be 0 rows).
SELECT
  'non_positive_hours' AS check_name,
  COUNT(*)::bigint AS violations
FROM time_report_entries
WHERE COALESCE(hours, 0) <= 0;

-- B) Duplicate day rows per consultant + line + date (must be 0 rows).
SELECT
  'duplicate_day_rows' AS check_name,
  COUNT(*)::bigint AS violations
FROM (
  SELECT consultant_id, entry_line_id, entry_date, COUNT(*) AS c
  FROM time_report_entries
  GROUP BY consultant_id, entry_line_id, entry_date
  HAVING COUNT(*) > 1
) d;

-- C) Orphan day rows without matching line header in same ISO week (must be 0 rows).
SELECT
  'orphan_day_rows_missing_header' AS check_name,
  COUNT(*)::bigint AS violations
FROM time_report_entries e
LEFT JOIN time_report_entry_lines l
  ON l.consultant_id = e.consultant_id
 AND l.id = e.entry_line_id
 AND l.iso_year = to_char(e.entry_date::date, 'IYYY')::int
 AND l.iso_week = to_char(e.entry_date::date, 'IW')::int
WHERE l.id IS NULL;

-- D) Headers with invalid customer/project/role references when set (must be 0 rows).
SELECT
  'invalid_header_fk_values' AS check_name,
  COUNT(*)::bigint AS violations
FROM time_report_entry_lines l
LEFT JOIN customers c ON c.id = l.customer_id
LEFT JOIN projects p ON p.id = l.project_id
LEFT JOIN roles r ON r.id = l.role_id
WHERE c.id IS NULL
   OR (l.project_id IS NOT NULL AND p.id IS NULL)
   OR (l.role_id IS NOT NULL AND r.id IS NULL);

-- E) Headers that have no day rows in their ISO week (informational, not always an error).
SELECT
  'headers_without_week_cells' AS check_name,
  COUNT(*)::bigint AS rows_count
FROM time_report_entry_lines l
LEFT JOIN time_report_entries e
  ON e.consultant_id = l.consultant_id
 AND e.entry_line_id = l.id
 AND to_char(e.entry_date::date, 'IYYY')::int = l.iso_year
 AND to_char(e.entry_date::date, 'IW')::int = l.iso_week
WHERE e.id IS NULL;
