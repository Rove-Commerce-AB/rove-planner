-- Time report optimistic concurrency, stable line keys, and audit history.
-- Run against the app database when deploying this feature.

-- 1) Week-level revision (ETag-style) per consultant + ISO year/week
CREATE TABLE IF NOT EXISTS time_report_week_revisions (
  consultant_id UUID NOT NULL REFERENCES consultants (id) ON DELETE CASCADE,
  iso_year INTEGER NOT NULL,
  iso_week INTEGER NOT NULL,
  revision BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_app_user_id UUID REFERENCES app_users (id),
  PRIMARY KEY (consultant_id, iso_year, iso_week)
);

CREATE INDEX IF NOT EXISTS time_report_week_revisions_consultant_idx
  ON time_report_week_revisions (consultant_id);

-- 2) Stable logical line id (client entry.id), backfilled for existing rows
ALTER TABLE time_report_entries
  ADD COLUMN IF NOT EXISTS entry_line_id UUID;

-- Backfill: one UUID per (consultant, ISO week, line identity) matching app grouping
WITH dims AS (
  SELECT
    id,
    consultant_id,
    to_char(entry_date::date, 'IYYY')::integer AS iso_year,
    to_char(entry_date::date, 'IW')::integer AS iso_week,
    customer_id,
    project_id,
    role_id,
    coalesce(jira_devops_key, '') AS jdk,
    display_order
  FROM time_report_entries
),
line_ids AS (
  SELECT DISTINCT ON (
    consultant_id,
    iso_year,
    iso_week,
    customer_id,
    project_id,
    role_id,
    jdk,
    display_order
  )
    consultant_id,
    iso_year,
    iso_week,
    customer_id,
    project_id,
    role_id,
    jdk,
    display_order,
    gen_random_uuid() AS entry_line_id
  FROM dims
  ORDER BY
    consultant_id,
    iso_year,
    iso_week,
    customer_id,
    project_id,
    role_id,
    jdk,
    display_order
)
UPDATE time_report_entries e
SET entry_line_id = li.entry_line_id
FROM dims d
INNER JOIN line_ids li ON (
  d.consultant_id = li.consultant_id
  AND d.iso_year = li.iso_year
  AND d.iso_week = li.iso_week
  AND d.customer_id = li.customer_id
  AND d.project_id = li.project_id
  AND d.role_id = li.role_id
  AND d.jdk = li.jdk
  AND d.display_order IS NOT DISTINCT FROM li.display_order
)
WHERE e.id = d.id;

-- Any stragglers (should be none)
UPDATE time_report_entries
SET entry_line_id = gen_random_uuid()
WHERE entry_line_id IS NULL;

ALTER TABLE time_report_entries
  ALTER COLUMN entry_line_id SET NOT NULL;

-- One row per calendar day for a logical line
CREATE UNIQUE INDEX IF NOT EXISTS time_report_entries_consultant_line_date_uniq
  ON time_report_entries (consultant_id, entry_line_id, entry_date);

-- 3) Immutable audit trail
CREATE TABLE IF NOT EXISTS time_report_entries_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_report_entry_id UUID,
  entry_line_id UUID NOT NULL,
  consultant_id UUID NOT NULL REFERENCES consultants (id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  before_json JSONB,
  after_json JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by_app_user_id UUID REFERENCES app_users (id),
  source_revision BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS time_report_entries_history_consultant_time_idx
  ON time_report_entries_history (consultant_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS time_report_entries_history_line_idx
  ON time_report_entries_history (entry_line_id, changed_at DESC);
