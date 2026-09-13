-- Custom, reorderable statuses per Work board.
-- Migrates work_issues.status from fixed keys to status ids.
-- Safe to rerun.

BEGIN;

CREATE TABLE IF NOT EXISTS work_board_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES work_boards (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_done BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE work_board_statuses
  ADD COLUMN IF NOT EXISTS legacy_key TEXT;

CREATE INDEX IF NOT EXISTS work_board_statuses_board_sort_idx
  ON work_board_statuses (board_id, sort_order);

INSERT INTO work_board_statuses (board_id, name, sort_order, is_done, legacy_key)
SELECT b.id, d.name, d.sort_order, d.is_done, d.legacy_key
FROM work_boards b
CROSS JOIN (
  VALUES
    ('todo', 'Todo', 0, false),
    ('in_progress', 'In progress', 1, false),
    ('to_be_tested', 'To be tested', 2, false),
    ('in_review', 'In review', 3, false),
    ('done', 'Done', 4, true)
) AS d(legacy_key, name, sort_order, is_done)
WHERE NOT EXISTS (
  SELECT 1 FROM work_board_statuses s WHERE s.board_id = b.id
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_issues'
      AND column_name = 'status'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE work_issues
      ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES work_board_statuses (id);

    UPDATE work_issues i
    SET status_id = s.id
    FROM work_board_statuses s
    WHERE s.board_id = i.board_id
      AND s.legacy_key = i.status
      AND i.status_id IS NULL;

    UPDATE work_issues i
    SET status_id = s.id
    FROM work_board_statuses s
    WHERE s.board_id = i.board_id
      AND i.status_id IS NULL
      AND s.sort_order = 0;

    ALTER TABLE work_issues
      DROP CONSTRAINT IF EXISTS work_issues_status_check;
    ALTER TABLE work_issues
      DROP COLUMN status;
    ALTER TABLE work_issues
      RENAME COLUMN status_id TO status;
    ALTER TABLE work_issues
      ALTER COLUMN status SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS work_issues_board_id_status_idx
  ON work_issues (board_id, status, sort_order);

ALTER TABLE work_board_statuses
  DROP COLUMN IF EXISTS legacy_key;

COMMIT;
