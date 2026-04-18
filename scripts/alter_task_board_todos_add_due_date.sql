-- Optional due date on task board todos (calendar date, no time zone semantics in UI).
-- Run once per database that already has task_board_todos without this column.

BEGIN;

ALTER TABLE task_board_todos
  ADD COLUMN IF NOT EXISTS due_date DATE NULL;

COMMIT;
