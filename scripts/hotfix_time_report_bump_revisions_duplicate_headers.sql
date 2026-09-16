-- Run AFTER deploying the month-view line-id merge hotfix.
-- Bumps ISO-week revisions for consultants who have same-shape duplicate headers,
-- so stale month-view tabs get revision_conflict instead of writing merged sums.
--
-- Does NOT change time_report_entries hours. Preview first, then run the UPDATE.
--
-- Preview (read-only):
/*
WITH dup_weeks AS (
  SELECT DISTINCT
    l.consultant_id,
    l.iso_year,
    l.iso_week
  FROM time_report_entry_lines l
  GROUP BY
    l.consultant_id,
    l.iso_year,
    l.iso_week,
    l.customer_id,
    l.project_id,
    l.role_id,
    COALESCE(l.jira_devops_key, ''),
    COALESCE(TRIM(l.description), '')
  HAVING COUNT(*) > 1
)
SELECT c.name, d.iso_year, d.iso_week, r.revision
FROM dup_weeks d
JOIN consultants c ON c.id = d.consultant_id
LEFT JOIN time_report_week_revisions r
  ON r.consultant_id = d.consultant_id
 AND r.iso_year = d.iso_year
 AND r.iso_week = d.iso_week
ORDER BY c.name, d.iso_year, d.iso_week;
*/

BEGIN;

WITH dup_weeks AS (
  SELECT DISTINCT
    l.consultant_id,
    l.iso_year,
    l.iso_week
  FROM time_report_entry_lines l
  GROUP BY
    l.consultant_id,
    l.iso_year,
    l.iso_week,
    l.customer_id,
    l.project_id,
    l.role_id,
    COALESCE(l.jira_devops_key, ''),
    COALESCE(TRIM(l.description), '')
  HAVING COUNT(*) > 1
)
INSERT INTO time_report_week_revisions (consultant_id, iso_year, iso_week, revision)
SELECT consultant_id, iso_year, iso_week, 1
FROM dup_weeks
ON CONFLICT (consultant_id, iso_year, iso_week) DO UPDATE
SET revision = time_report_week_revisions.revision + 1,
    updated_at = now();

COMMIT;
