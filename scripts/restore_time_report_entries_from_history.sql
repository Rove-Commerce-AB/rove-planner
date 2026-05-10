-- Restore accidentally deleted time report entries from audit history.
-- Safe-by-default: restores only rows deleted in a chosen time window.
--
-- Usage:
-- 1) Set params in the CTE below (especially restore_from_utc).
-- 2) Run this script once.
-- 3) Verify restored rows with the final SELECT statements.

BEGIN;

WITH params AS (
  SELECT
    -- Set to a specific consultant UUID to scope restore, or keep NULL for all.
    NULL::uuid AS consultant_id_filter,
    -- REQUIRED: choose a UTC start time before the incident.
    TIMESTAMPTZ '2026-05-09 07:00:00+00' AS restore_from_utc,
    -- Optional end time (normally now).
    now()::timestamptz AS restore_to_utc
),
deleted_candidates AS (
  SELECT
    h.id AS history_id,
    h.changed_at,
    h.consultant_id,
    h.entry_line_id,
    h.before_json,
    (h.before_json ->> 'id')::uuid AS time_report_entry_id,
    (h.before_json ->> 'customer_id')::uuid AS customer_id,
    (h.before_json ->> 'project_id')::uuid AS project_id,
    (h.before_json ->> 'role_id')::uuid AS role_id,
    (h.before_json ->> 'jira_devops_key')::text AS jira_devops_key,
    (h.before_json ->> 'description')::text AS description,
    (h.before_json ->> 'entry_date')::date AS entry_date,
    (h.before_json ->> 'hours')::numeric AS hours,
    (h.before_json ->> 'internal_comment')::text AS internal_comment,
    (h.before_json ->> 'rate_snapshot')::numeric AS rate_snapshot,
    COALESCE((h.before_json ->> 'display_order')::int, 0) AS display_order
  FROM time_report_entries_history h
  CROSS JOIN params p
  WHERE h.operation = 'delete'
    AND h.before_json IS NOT NULL
    AND h.changed_at >= p.restore_from_utc
    AND h.changed_at <= p.restore_to_utc
    AND (p.consultant_id_filter IS NULL OR h.consultant_id = p.consultant_id_filter)
),
valid_candidates AS (
  SELECT *
  FROM deleted_candidates c
  WHERE c.time_report_entry_id IS NOT NULL
    AND c.entry_line_id IS NOT NULL
    AND c.customer_id IS NOT NULL
    AND c.project_id IS NOT NULL
    AND c.role_id IS NOT NULL
    AND c.entry_date IS NOT NULL
    AND c.hours IS NOT NULL
    AND c.hours > 0
),
missing_entries AS (
  SELECT c.*
  FROM valid_candidates c
  LEFT JOIN time_report_entries e ON e.id = c.time_report_entry_id
  WHERE e.id IS NULL
),
line_upsert AS (
  INSERT INTO time_report_entry_lines (
    id,
    consultant_id,
    iso_year,
    iso_week,
    customer_id,
    project_id,
    role_id,
    jira_devops_key,
    description,
    display_order
  )
  SELECT DISTINCT
    m.entry_line_id,
    m.consultant_id,
    to_char(m.entry_date::date, 'IYYY')::int AS iso_year,
    to_char(m.entry_date::date, 'IW')::int AS iso_week,
    m.customer_id,
    m.project_id,
    m.role_id,
    m.jira_devops_key,
    m.description,
    m.display_order
  FROM missing_entries m
  ON CONFLICT (consultant_id, iso_year, iso_week, id) DO UPDATE
    SET customer_id = EXCLUDED.customer_id,
        project_id = EXCLUDED.project_id,
        role_id = EXCLUDED.role_id,
        jira_devops_key = EXCLUDED.jira_devops_key,
        description = EXCLUDED.description,
        display_order = EXCLUDED.display_order
  RETURNING 1
),
entry_insert AS (
  INSERT INTO time_report_entries (
    id,
    consultant_id,
    customer_id,
    project_id,
    role_id,
    jira_devops_key,
    description,
    entry_date,
    hours,
    pm_edited_hours,
    internal_comment,
    rate_snapshot,
    display_order,
    entry_line_id
  )
  SELECT
    m.time_report_entry_id,
    m.consultant_id,
    m.customer_id,
    m.project_id,
    m.role_id,
    m.jira_devops_key,
    m.description,
    m.entry_date,
    m.hours,
    m.hours,
    NULLIF(m.internal_comment, ''),
    m.rate_snapshot,
    m.display_order,
    m.entry_line_id
  FROM missing_entries m
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
SELECT
  (SELECT count(*) FROM missing_entries) AS missing_entry_candidates,
  (SELECT count(*) FROM entry_insert) AS restored_entries;

COMMIT;

-- Optional verification:
-- SELECT changed_at, consultant_id, entry_line_id
-- FROM time_report_entries_history
-- WHERE operation = 'delete'
-- ORDER BY changed_at DESC
-- LIMIT 50;
