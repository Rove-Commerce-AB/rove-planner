-- Time report line model hardening (idempotent, non-destructive).
-- Run after the initial line-model migration.

BEGIN;

-- 1) Ensure PK shape matches week-scoped line identity.
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

CREATE UNIQUE INDEX IF NOT EXISTS time_report_entry_lines_consultant_week_line_uniq
  ON time_report_entry_lines (consultant_id, iso_year, iso_week, id);

CREATE INDEX IF NOT EXISTS time_report_entry_lines_consultant_week_display_idx
  ON time_report_entry_lines (consultant_id, iso_year, iso_week, display_order, id);

-- 2) Draft rows may not yet have project/role.
ALTER TABLE time_report_entry_lines
  ALTER COLUMN project_id DROP NOT NULL,
  ALTER COLUMN role_id DROP NOT NULL;

-- 3) Day-level entries must represent actual booked time.
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

-- 4) Keep one day-row per consultant/line/date.
CREATE UNIQUE INDEX IF NOT EXISTS time_report_entries_consultant_line_date_uniq
  ON time_report_entries (consultant_id, entry_line_id, entry_date);

COMMIT;
