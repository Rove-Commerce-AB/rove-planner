-- Archive Work boards instead of deleting them.
-- Safe to rerun.

BEGIN;

ALTER TABLE work_boards
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS work_boards_customer_active_idx
  ON work_boards (customer_id)
  WHERE archived_at IS NULL;

COMMIT;
