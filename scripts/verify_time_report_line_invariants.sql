-- Read-only invariant checks for time report line model.
--
-- Release gate (violations MUST be 0): blocks A–D only.
-- blocks E–H use rows_count — informational / drift / legacy noise (do not fail deploy on these).

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

-- F) Duplicate header *pairs* (same week + shape + display_order) with trimmed task OR jira set.
--    rows_count — advisory only: repeated labels / legacy copies often produce hundreds of pairs.
SELECT
  'duplicate_line_headers_same_week_nontrivial_shape_pairs' AS check_name,
  COUNT(*)::bigint AS rows_count
FROM time_report_entry_lines l1
JOIN time_report_entry_lines l2
  ON l1.consultant_id = l2.consultant_id
 AND l1.iso_year = l2.iso_year
 AND l1.iso_week = l2.iso_week
 AND l1.customer_id = l2.customer_id
 AND COALESCE(l1.project_id::text, '') = COALESCE(l2.project_id::text, '')
 AND COALESCE(l1.role_id::text, '') = COALESCE(l2.role_id::text, '')
 AND COALESCE(l1.jira_devops_key, '') = COALESCE(l2.jira_devops_key, '')
 AND COALESCE(TRIM(l1.description), '') = COALESCE(TRIM(l2.description), '')
 AND l1.display_order = l2.display_order
 AND l1.id < l2.id
WHERE (
  NULLIF(TRIM(COALESCE(l1.description, '')), '') IS NOT NULL
  OR NULLIF(TRIM(COALESCE(l1.jira_devops_key, '')), '') IS NOT NULL
);

-- G) Same as F but only blank task + blank jira (informational).
SELECT
  'duplicate_line_headers_blank_task_and_jira' AS check_name,
  COUNT(*)::bigint AS rows_count
FROM time_report_entry_lines l1
JOIN time_report_entry_lines l2
  ON l1.consultant_id = l2.consultant_id
 AND l1.iso_year = l2.iso_year
 AND l1.iso_week = l2.iso_week
 AND l1.customer_id = l2.customer_id
 AND COALESCE(l1.project_id::text, '') = COALESCE(l2.project_id::text, '')
 AND COALESCE(l1.role_id::text, '') = COALESCE(l2.role_id::text, '')
 AND COALESCE(l1.jira_devops_key, '') = COALESCE(l2.jira_devops_key, '')
 AND COALESCE(TRIM(l1.description), '') = COALESCE(TRIM(l2.description), '')
 AND l1.display_order = l2.display_order
 AND l1.id < l2.id
WHERE NULLIF(TRIM(COALESCE(l1.description, '')), '') IS NULL
  AND NULLIF(TRIM(COALESCE(l1.jira_devops_key, '')), '') IS NULL;

-- H) Like F, but both headers have ≥1 cell dated in their ISO week — sharper signal for “real” duplicate rows.
SELECT
  'duplicate_line_headers_nontrivial_both_have_week_cells_pairs' AS check_name,
  COUNT(*)::bigint AS rows_count
FROM time_report_entry_lines l1
JOIN time_report_entry_lines l2
  ON l1.consultant_id = l2.consultant_id
 AND l1.iso_year = l2.iso_year
 AND l1.iso_week = l2.iso_week
 AND l1.customer_id = l2.customer_id
 AND COALESCE(l1.project_id::text, '') = COALESCE(l2.project_id::text, '')
 AND COALESCE(l1.role_id::text, '') = COALESCE(l2.role_id::text, '')
 AND COALESCE(l1.jira_devops_key, '') = COALESCE(l2.jira_devops_key, '')
 AND COALESCE(TRIM(l1.description), '') = COALESCE(TRIM(l2.description), '')
 AND l1.display_order = l2.display_order
 AND l1.id < l2.id
WHERE (
  NULLIF(TRIM(COALESCE(l1.description, '')), '') IS NOT NULL
  OR NULLIF(TRIM(COALESCE(l1.jira_devops_key, '')), '') IS NOT NULL
)
AND EXISTS (
  SELECT 1
  FROM time_report_entries e
  WHERE e.consultant_id = l1.consultant_id
    AND e.entry_line_id = l1.id
    AND to_char(e.entry_date::date, 'IYYY')::int = l1.iso_year
    AND to_char(e.entry_date::date, 'IW')::int = l1.iso_week
)
AND EXISTS (
  SELECT 1
  FROM time_report_entries e
  WHERE e.consultant_id = l2.consultant_id
    AND e.entry_line_id = l2.id
    AND to_char(e.entry_date::date, 'IYYY')::int = l2.iso_year
    AND to_char(e.entry_date::date, 'IW')::int = l2.iso_week
);
