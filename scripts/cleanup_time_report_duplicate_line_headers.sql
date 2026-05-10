-- Merge duplicate time-report LINE HEADERS within the same ISO week when every dimension
-- of the merge fingerprint matches (including display_order). This removes redundant UUIDs
-- that inflate duplicate-header counts and can confuse month/week payloads after reload.
--
-- IMPORTANT:
-- 1) Run scripts/backup_time_report_tables_pre_cleanup.sql first (or pg_dump).
-- 2) Review the PREVIEW queries below on a copy of prod before COMMIT.
-- 3) Take browsers offline / notify users: consultants affected get revision bumps — active saves may conflict once.
--
-- Fingerprints match month-merge semantics + verify script F:
--   consultant_id, iso_year, iso_week, customer_id, project_id, role_id,
--   COALESCE(jira_devops_key,''), COALESCE(TRIM(description),''), display_order
--
-- Keeper rule: lexicographically smallest UUID text per cluster (deterministic).
-- Same-calendar-day cells on keeper vs loser: hours summed, comments concatenated, loser cell deleted.
-- Remaining loser-only cells: entry_line_id repointed to keeper (+ header-aligned display_order).
--
-- Does NOT merge rows that differ only by display_order — those stay distinct.
--
-- UX: Month view also keeps rows apart when display_order differs (see mergeKey in
-- src/lib/timeReportMonthMerge.ts). Running only this script therefore leaves “duplicate-looking”
-- rows if legacy data assigned different display_order to the same project/role/task shape.
-- Use PREVIEW C to confirm; optional second pass:
--   scripts/cleanup_time_report_duplicate_line_headers_merge_same_shape.sql
--
-- Implementation note: line UUIDs repeat across ISO weeks (PK is consultant+year+week+id).
-- dup_line_pairs MUST key losers by (consultant_id, iso_year, iso_week, loser_id), never loser_id alone.
-- Joins to time_report_entries use entry_date ISO week so cells match the correct header row.

-- ========= PREVIEW (read-only) =========
-- PostgreSQL: a WITH (...) clause applies only to the *single* SQL statement after it.
-- Supabase / split-by-semicolon runners abort the second SELECT with "relation clusters does not exist".
-- Run each preview below as its **own** query (two separate runs), or highlight only one block.

-- --- PREVIEW A — aggregate counts ---
/*
WITH clusters AS (
  SELECT
    consultant_id,
    iso_year,
    iso_week,
    customer_id,
    project_id,
    role_id,
    COALESCE(jira_devops_key, '') AS jk,
    COALESCE(TRIM(description), '') AS descr,
    display_order,
    COUNT(*)::bigint AS header_cnt,
    MIN(id::text)::uuid AS keeper_id,
    ARRAY_AGG(id::text ORDER BY id::text) AS member_ids
  FROM time_report_entry_lines
  GROUP BY
    consultant_id,
    iso_year,
    iso_week,
    customer_id,
    project_id,
    role_id,
    COALESCE(jira_devops_key, ''),
    COALESCE(TRIM(description), ''),
    display_order
  HAVING COUNT(*) > 1
)
SELECT
  COUNT(*) AS duplicate_clusters,
  SUM(header_cnt - 1) AS loser_headers_to_remove,
  SUM(header_cnt) AS headers_in_clusters
FROM clusters;
*/

-- --- PREVIEW B — sample clusters (same CTE definition; run separately from PREVIEW A) ---
/*
WITH clusters AS (
  SELECT
    consultant_id,
    iso_year,
    iso_week,
    customer_id,
    project_id,
    role_id,
    COALESCE(jira_devops_key, '') AS jk,
    COALESCE(TRIM(description), '') AS descr,
    display_order,
    COUNT(*)::bigint AS header_cnt,
    MIN(id::text)::uuid AS keeper_id,
    ARRAY_AGG(id::text ORDER BY id::text) AS member_ids
  FROM time_report_entry_lines
  GROUP BY
    consultant_id,
    iso_year,
    iso_week,
    customer_id,
    project_id,
    role_id,
    COALESCE(jira_devops_key, ''),
    COALESCE(TRIM(description), ''),
    display_order
  HAVING COUNT(*) > 1
)
SELECT c.*
FROM clusters c
ORDER BY header_cnt DESC, consultant_id, iso_year, iso_week
LIMIT 50;
*/

-- --- PREVIEW C — same customer/project/role/jira/task in one ISO week, ignoring display_order ---
-- If header_cnt > 1 here but PREVIEW A was empty, “duplicate” UI rows are almost certainly
-- different display_order (or merge already cleared strict duplicates).
/*
WITH shape_clusters AS (
  SELECT
    consultant_id,
    iso_year,
    iso_week,
    customer_id,
    project_id,
    role_id,
    COALESCE(jira_devops_key, '') AS jk,
    COALESCE(TRIM(description), '') AS descr,
    COUNT(*)::bigint AS header_cnt,
    COUNT(DISTINCT display_order)::bigint AS distinct_display_orders,
    ARRAY_AGG(id::text ORDER BY display_order, id::text) AS member_ids,
    ARRAY_AGG(display_order ORDER BY display_order, id::text) AS display_orders
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
)
SELECT *
FROM shape_clusters
ORDER BY header_cnt DESC, consultant_id, iso_year, iso_week
LIMIT 80;
*/

-- ========= APPLY CLEANUP =========

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
    display_order,
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
    COALESCE(TRIM(description), ''),
    display_order
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
 AND loser.display_order = cluster.display_order
WHERE loser.id <> cluster.keeper_id;

-- Nothing to do — exit cleanly.
DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*)::int INTO n FROM dup_line_pairs;
  IF n = 0 THEN
    RAISE NOTICE 'cleanup_time_report_duplicate_line_headers: no duplicate clusters — skipping.';
  ELSE
    RAISE NOTICE 'cleanup_time_report_duplicate_line_headers: merging % loser header(s).', n;
  END IF;
END $$;

-- 1) Same calendar day on keeper + loser: sum hours into keeper, merge comments, delete loser cells.
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

-- 2) Remaining cells still pointing at losers → repoint to keeper (unique line+date enforced).
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

-- Sanity: no entries should reference losers before header delete.
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
    RAISE EXCEPTION 'cleanup_time_report_duplicate_line_headers: % entries still reference loser lines — abort.', orphans;
  END IF;
END $$;

DELETE FROM time_report_entry_lines l
USING dup_line_pairs p
WHERE l.consultant_id = p.consultant_id
  AND l.iso_year = p.iso_year
  AND l.iso_week = p.iso_week
  AND l.id = p.loser_id;

-- Bump optimistic-lock revisions for touched consultant/weeks (reload recommended).
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

-- After deploy: ask users to reload / reopen month view.
