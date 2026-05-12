-- Google Tasks sync support for taskboard.
-- Run manually against your Postgres database (same approach as other scripts).

BEGIN;

CREATE TABLE IF NOT EXISTS google_user_connections (
  app_user_id UUID PRIMARY KEY REFERENCES app_users (id) ON DELETE CASCADE,
  google_sub TEXT NOT NULL,
  google_email TEXT NULL,
  scope TEXT NULL,
  access_token TEXT NULL,
  refresh_token TEXT NULL,
  token_type TEXT NULL,
  access_token_expires_at TIMESTAMPTZ NULL,
  last_sync_at TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_board_google_task_lists (
  app_user_id UUID NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES task_boards (id) ON DELETE CASCADE,
  google_task_list_id TEXT NOT NULL,
  google_task_list_title TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_user_id, board_id),
  UNIQUE (app_user_id, google_task_list_id)
);

CREATE TABLE IF NOT EXISTS task_board_google_task_map (
  app_user_id UUID NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES task_boards (id) ON DELETE CASCADE,
  todo_id UUID NOT NULL REFERENCES task_board_todos (id) ON DELETE CASCADE,
  google_task_list_id TEXT NOT NULL,
  google_task_id TEXT NOT NULL,
  source_last_write TEXT NOT NULL DEFAULT 'taskboard',
  source_last_modified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_user_id, todo_id),
  UNIQUE (app_user_id, google_task_list_id, google_task_id)
);

CREATE INDEX IF NOT EXISTS task_board_google_task_map_board_idx
  ON task_board_google_task_map (app_user_id, board_id);

COMMIT;
