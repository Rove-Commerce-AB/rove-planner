-- OPTIONAL second pass after cleanup_time_report_duplicate_line_headers.sql
--
-- Merges duplicate LINE HEADERS in the same ISO week when customer/project/role/jira/description
-- match — **ignoring display_order**. Use when PREVIEW C shows clusters but PREVIEW A is empty:
-- UI shows several identical-looking rows that differ only by display_order (legacy copies).
--
-- Keeper rule: lexicographically smallest UUID per cluster (same as strict cleanup).
-- Survivor header gets display_order = MIN(display_order) over merged headers so sorting improves.
--
-- Risk: If someone intentionally maintained two grid rows with identical dropdowns but different
-- ordering semantics, this collapses them. Prefer confirming PREVIEW C on prod-like data first.
--
-- IMPORTANT:
-- 1) Backup first (scripts/backup_time_report_tables_pre_cleanup.sql or pg_dump).
-- 2) Run strict cleanup script first so identical fingerprints including display_order are gone.

BEGIN;

CREATE TEMP TABLE dup_line_pairs (
  keeper_id uuid NOT NULL,
  loser_id uuid NOT NULL,
  consultant_id uuid NOT NULL,
  iso_year integer NOT NULL,
  iso_week integer NOT NULL,
  PRIMARY KEY (consultant_id, iso_year, iso_week, loser_id)
) ON COMMIT DROP;

INSERT INTO dup_line_pairs (keeper_id, loser_id, consultant_id, iso_year, iso_week)
SELECT
  cluster.keeper_id,
  loser.id AS loser_id,
  loser.consultant_id,
  loser.iso_year,
  loser.iso_week
FROM (
  SELECT
    consultant_id,
    iso_year,
    iso_week,
    customer_id,
    project_id,
    role_id,
    COALESCE(jira_devops_key, '') AS jk,
    COALESCE(TRIM(description), '') AS descr,
    MIN(id::text)::uuid AS keeper_id
  FROM time_report_entry_lines
  GROUP BY
    consultant_id,
    iso_year,
    iso_week,
    customer_id,
    project_id,
    role_id,
    COALESCE(jira_devops_key, ''),
    COALESCE(TRIM(description), '')
  HAVING COUNT(*) > 1
) cluster
JOIN time_report_entry_lines loser ON
     loser.consultant_id = cluster.consultant_id
 AND loser.iso_year = cluster.iso_year
 AND loser.iso_week = cluster.iso_week
 AND loser.customer_id = cluster.customer_id
 AND loser.project_id IS NOT DISTINCT FROM cluster.project_id
 AND loser.role_id IS NOT DISTINCT FROM cluster.role_id
 AND COALESCE(loser.jira_devops_key, '') = cluster.jk
 AND COALESCE(TRIM(loser.description), '') = cluster.descr
WHERE loser.id <> cluster.keeper_id;

CREATE TEMP TABLE cluster_min_display_order (
  consultant_id uuid NOT NULL,
  iso_year integer NOT NULL,
  iso_week integer NOT NULL,
  keeper_id uuid NOT NULL,
  min_display_order integer NOT NULL,
  PRIMARY KEY (consultant_id, iso_year, iso_week, keeper_id)
) ON COMMIT DROP;

INSERT INTO cluster_min_display_order (
  consultant_id,
  iso_year,
  iso_week,
  keeper_id,
  min_display_order
)
SELECT
  c.consultant_id,
  c.iso_year,
  c.iso_week,
  c.keeper_id,
  MIN(l.display_order)::integer
FROM (
  SELECT
    consultant_id,
    iso_year,
    iso_week,
    customer_id,
    project_id,
    role_id,
    COALESCE(jira_devops_key, '') AS jk,
    COALESCE(TRIM(description), '') AS descr,
    MIN(id::text)::uuid AS keeper_id
  FROM time_report_entry_lines
  GROUP BY
    consultant_id,
    iso_year,
    iso_week,
    customer_id,
    project_id,
    role_id,
    COALESCE(jira_devops_key, ''),
    COALESCE(TRIM(description), '')
  HAVING COUNT(*) > 1
) c
JOIN time_report_entry_lines l ON
     l.consultant_id = c.consultant_id
 AND l.iso_year = c.iso_year
 AND l.iso_week = c.iso_week
 AND l.customer_id = c.customer_id
 AND l.project_id IS NOT DISTINCT FROM c.project_id
 AND l.role_id IS NOT DISTINCT FROM c.role_id
 AND COALESCE(l.jira_devops_key, '') = c.jk
 AND COALESCE(TRIM(l.description), '') = c.descr
GROUP BY c.consultant_id, c.iso_year, c.iso_week, c.keeper_id;

DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*)::int INTO n FROM dup_line_pairs;
  IF n = 0 THEN
    RAISE NOTICE 'cleanup_time_report_merge_same_shape: no clusters — skipping.';
  ELSE
    RAISE NOTICE 'cleanup_time_report_merge_same_shape: merging % loser header(s).', n;
  END IF;
END $$;

WITH agg AS (
  SELECT
    w.id AS winner_entry_pk,
    SUM(l.hours) AS sum_loser_hours,
    STRING_AGG(NULLIF(TRIM(l.internal_comment), ''), E'\n' ORDER BY l.id::text) AS loser_notes
  FROM dup_line_pairs p
  JOIN time_report_entries l
    ON l.entry_line_id = p.loser_id
   AND l.consultant_id = p.consultant_id
   AND to_char(l.entry_date::date, 'IYYY')::int = p.iso_year
   AND to_char(l.entry_date::date, 'IW')::int = p.iso_week
  JOIN time_report_entries w
    ON w.entry_line_id = p.keeper_id
   AND w.consultant_id = l.consultant_id
   AND w.entry_date = l.entry_date
   AND to_char(w.entry_date::date, 'IYYY')::int = p.iso_year
   AND to_char(w.entry_date::date, 'IW')::int = p.iso_week
  GROUP BY w.id
)
UPDATE time_report_entries w
SET
  hours = w.hours + agg.sum_loser_hours,
  pm_edited_hours = COALESCE(w.pm_edited_hours, w.hours) + agg.sum_loser_hours,
  internal_comment = CASE
    WHEN agg.loser_notes IS NULL THEN w.internal_comment
    WHEN NULLIF(TRIM(w.internal_comment), '') IS NULL THEN agg.loser_notes
    ELSE TRIM(w.internal_comment) || E'\n' || agg.loser_notes
  END
FROM agg
WHERE w.id = agg.winner_entry_pk;

DELETE FROM time_report_entries e
USING dup_line_pairs p,
      time_report_entries w
WHERE e.entry_line_id = p.loser_id
  AND e.consultant_id = p.consultant_id
  AND to_char(e.entry_date::date, 'IYYY')::int = p.iso_year
  AND to_char(e.entry_date::date, 'IW')::int = p.iso_week
  AND w.entry_line_id = p.keeper_id
  AND w.consultant_id = e.consultant_id
  AND w.entry_date = e.entry_date
  AND to_char(w.entry_date::date, 'IYYY')::int = p.iso_year
  AND to_char(w.entry_date::date, 'IW')::int = p.iso_week;

UPDATE time_report_entries e
SET
  entry_line_id = p.keeper_id,
  display_order = hl.display_order,
  customer_id = hl.customer_id,
  project_id = hl.project_id,
  role_id = hl.role_id,
  jira_devops_key = hl.jira_devops_key,
  description = hl.description
FROM dup_line_pairs p
JOIN time_report_entry_lines hl ON
     hl.consultant_id = p.consultant_id
 AND hl.iso_year = p.iso_year
 AND hl.iso_week = p.iso_week
 AND hl.id = p.keeper_id
WHERE e.entry_line_id = p.loser_id
  AND e.consultant_id = p.consultant_id
  AND to_char(e.entry_date::date, 'IYYY')::int = p.iso_year
  AND to_char(e.entry_date::date, 'IW')::int = p.iso_week;

UPDATE time_report_entry_lines hl
SET
  display_order = m.min_display_order,
  updated_at = now()
FROM cluster_min_display_order m
WHERE hl.consultant_id = m.consultant_id
  AND hl.iso_year = m.iso_year
  AND hl.iso_week = m.iso_week
  AND hl.id = m.keeper_id;

UPDATE time_report_entries e
SET display_order = m.min_display_order
FROM cluster_min_display_order m
WHERE e.consultant_id = m.consultant_id
  AND e.entry_line_id = m.keeper_id
  AND to_char(e.entry_date::date, 'IYYY')::int = m.iso_year
  AND to_char(e.entry_date::date, 'IW')::int = m.iso_week;

DO $$
DECLARE
  orphans bigint;
BEGIN
  SELECT COUNT(*) INTO orphans
  FROM time_report_entries e
  JOIN dup_line_pairs p ON e.entry_line_id = p.loser_id
    AND e.consultant_id = p.consultant_id
    AND to_char(e.entry_date::date, 'IYYY')::int = p.iso_year
    AND to_char(e.entry_date::date, 'IW')::int = p.iso_week;
  IF orphans > 0 THEN
    RAISE EXCEPTION 'cleanup_time_report_merge_same_shape: % entries still reference loser lines — abort.', orphans;
  END IF;
END $$;

DELETE FROM time_report_entry_lines l
USING dup_line_pairs p
WHERE l.consultant_id = p.consultant_id
  AND l.iso_year = p.iso_year
  AND l.iso_week = p.iso_week
  AND l.id = p.loser_id;

WITH weeks AS (
  SELECT DISTINCT consultant_id, iso_year, iso_week
  FROM dup_line_pairs
)
INSERT INTO time_report_week_revisions (consultant_id, iso_year, iso_week, revision)
SELECT w.consultant_id, w.iso_year, w.iso_week, 0
FROM weeks w
ON CONFLICT (consultant_id, iso_year, iso_week) DO NOTHING;

UPDATE time_report_week_revisions r
SET revision = r.revision + 1,
    updated_at = now()
FROM (
  SELECT DISTINCT consultant_id, iso_year, iso_week FROM dup_line_pairs
) w
WHERE r.consultant_id = w.consultant_id
  AND r.iso_year = w.iso_year
  AND r.iso_week = w.iso_week;

COMMIT;
