-- Rove Work issues + board prefix (sequential keys per board).
-- Safe to rerun.

BEGIN;

ALTER TABLE work_boards
  ADD COLUMN IF NOT EXISTS prefix TEXT;

UPDATE work_boards b
SET prefix = UPPER(LEFT(REGEXP_REPLACE(c.name, '[^A-Za-z]', '', 'g'), 3))
FROM customers c
WHERE c.id = b.customer_id
  AND (b.prefix IS NULL OR btrim(b.prefix) = '');

UPDATE work_boards
SET prefix = 'WB'
WHERE prefix IS NULL OR length(prefix) < 2;

-- Make prefixes unique per customer when the backfill collided.
WITH ranked AS (
  SELECT
    id,
    customer_id,
    prefix,
    ROW_NUMBER() OVER (PARTITION BY customer_id, prefix ORDER BY created_at, id) AS n
  FROM work_boards
)
UPDATE work_boards b
SET prefix = LEFT(ranked.prefix || ranked.n::text, 8)
FROM ranked
WHERE b.id = ranked.id
  AND ranked.n > 1;

ALTER TABLE work_boards
  ALTER COLUMN prefix SET NOT NULL;

ALTER TABLE work_boards
  DROP CONSTRAINT IF EXISTS work_boards_prefix_check;
ALTER TABLE work_boards
  ADD CONSTRAINT work_boards_prefix_check
  CHECK (prefix ~ '^[A-Z][A-Z0-9]{1,7}$');

CREATE UNIQUE INDEX IF NOT EXISTS work_boards_customer_prefix_idx
  ON work_boards (customer_id, prefix);

CREATE TABLE IF NOT EXISTS work_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES work_boards (id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  assigned_to_app_user_id UUID NULL REFERENCES app_users (id) ON DELETE SET NULL,
  created_by_app_user_id UUID NOT NULL REFERENCES app_users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (board_id, number)
);

ALTER TABLE work_issues
  DROP CONSTRAINT IF EXISTS work_issues_status_check;
ALTER TABLE work_issues
  ADD CONSTRAINT work_issues_status_check
  CHECK (status IN (
    'todo',
    'in_progress',
    'to_be_tested',
    'in_review',
    'done'
  ));

CREATE INDEX IF NOT EXISTS work_issues_board_id_status_idx
  ON work_issues (board_id, status, sort_order);

DROP TRIGGER IF EXISTS trg_work_issues_updated_at ON work_issues;
CREATE TRIGGER trg_work_issues_updated_at
  BEFORE UPDATE ON work_issues
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

COMMIT;

SELECT to_regclass('work_issues') AS work_issues;
