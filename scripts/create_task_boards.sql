-- Taskboard: boards, members, and todos.
-- Run manually against your Postgres database (e.g. psql, Cloud Console).
-- There is no migration runner in this repo; apply once per environment.
--
-- After creating a board row, application code should INSERT the creator into
-- task_board_members (same transaction). Sorting: active todos first, then
-- done; within done, use sort_order (set to max+1 when marking done so newest
-- done is last overall).

BEGIN;

CREATE TABLE IF NOT EXISTS task_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_by_app_user_id UUID NOT NULL REFERENCES app_users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_board_members (
  board_id UUID NOT NULL REFERENCES task_boards (id) ON DELETE CASCADE,
  app_user_id UUID NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, app_user_id)
);

-- Composite PK supports board_id lookups; separate index for "boards for this user".
CREATE INDEX IF NOT EXISTS task_board_members_app_user_id_idx
  ON task_board_members (app_user_id);

CREATE TABLE IF NOT EXISTS task_board_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES task_boards (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('todo', 'done')),
  sort_order INT NOT NULL DEFAULT 0,
  assigned_to_app_user_id UUID NULL REFERENCES app_users (id) ON DELETE SET NULL,
  due_date DATE NULL
);

CREATE INDEX IF NOT EXISTS task_board_todos_board_id_idx
  ON task_board_todos (board_id);

COMMIT;
