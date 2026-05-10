-- Introduce stable row headers for time report lines.
-- Rows live in time_report_entry_lines, day cells live in time_report_entries.
-- Run after alter_time_report_concurrency.sql.

CREATE TABLE IF NOT EXISTS time_report_entry_lines (
  id UUID NOT NULL,
  consultant_id UUID NOT NULL REFERENCES consultants (id) ON DELETE CASCADE,
  iso_year INTEGER NOT NULL,
  iso_week INTEGER NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  project_id UUID REFERENCES projects (id) ON DELETE RESTRICT,
  role_id UUID REFERENCES roles (id) ON DELETE RESTRICT,
  jira_devops_key TEXT,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS time_report_entry_lines_consultant_week_idx
  ON time_report_entry_lines (consultant_id, iso_year, iso_week, display_order, id);

CREATE UNIQUE INDEX IF NOT EXISTS time_report_entry_lines_consultant_week_line_uniq
  ON time_report_entry_lines (consultant_id, iso_year, iso_week, id);

-- Drop any foreign keys that reference this table before changing PK shape.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      con.conname AS constraint_name,
      nsp.nspname AS schema_name,
      cls.relname AS table_name
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE con.contype = 'f'
      AND con.confrelid = 'time_report_entry_lines'::regclass
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT %I',
      rec.schema_name,
      rec.table_name,
      rec.constraint_name
    );
  END LOOP;
END $$;

-- Line id is only unique within consultant+ISO week (month save can reuse ids across weeks).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'time_report_entry_lines_pkey'
  ) THEN
    ALTER TABLE time_report_entry_lines
      DROP CONSTRAINT time_report_entry_lines_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'time_report_entry_lines_consultant_week_pk'
  ) THEN
    ALTER TABLE time_report_entry_lines
      ADD CONSTRAINT time_report_entry_lines_consultant_week_pk
      PRIMARY KEY (consultant_id, iso_year, iso_week, id);
  END IF;
END $$;

-- Backfill one row header per existing (consultant, ISO week, entry_line_id).
INSERT INTO time_report_entry_lines (
  id, consultant_id, iso_year, iso_week, customer_id, project_id, role_id,
  jira_devops_key, description, display_order
)
SELECT DISTINCT ON (
  e.consultant_id,
  to_char(e.entry_date::date, 'IYYY')::integer,
  to_char(e.entry_date::date, 'IW')::integer,
  e.entry_line_id
)
  e.entry_line_id AS id,
  e.consultant_id,
  to_char(e.entry_date::date, 'IYYY')::integer AS iso_year,
  to_char(e.entry_date::date, 'IW')::integer AS iso_week,
  e.customer_id,
  e.project_id,
  e.role_id,
  e.jira_devops_key,
  e.description,
  COALESCE(e.display_order, 0)::integer
FROM time_report_entries e
WHERE e.entry_line_id IS NOT NULL
ON CONFLICT (consultant_id, iso_year, iso_week, id) DO NOTHING;

-- Clean up legacy rows with non-positive hours.
-- With the new model, zero-hour entries are treated as deleted (line header remains if needed).
DELETE FROM time_report_entries
WHERE COALESCE(hours, 0) <= 0;

-- Ensure day entries always represent actual reported time.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'time_report_entries_positive_hours_chk'
  ) THEN
    ALTER TABLE time_report_entries
      ADD CONSTRAINT time_report_entries_positive_hours_chk CHECK (hours > 0);
  END IF;
END $$;

-- Empty rows may exist without project/role until user picks values.
ALTER TABLE time_report_entry_lines
  ALTER COLUMN project_id DROP NOT NULL,
  ALTER COLUMN role_id DROP NOT NULL;

-- Drop legacy FK if present; line id is no longer globally unique in header table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'time_report_entries_entry_line_fk'
  ) THEN
    ALTER TABLE time_report_entries
      DROP CONSTRAINT time_report_entries_entry_line_fk;
  END IF;
END $$;
