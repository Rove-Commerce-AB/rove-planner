-- Add optional assignee on task board todos (must be a board member in app logic).
-- Run once per database that already has task_board_todos without this column.

BEGIN;

ALTER TABLE task_board_todos
  ADD COLUMN IF NOT EXISTS assigned_to_app_user_id UUID NULL
    REFERENCES app_users (id) ON DELETE SET NULL;

COMMIT;
