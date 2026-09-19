-- ClickUp sync support for time report integrations.
-- Run manually against your Postgres database.

BEGIN;

CREATE TABLE IF NOT EXISTS clickup (
  clickup_id TEXT PRIMARY KEY,
  summary TEXT NULL,
  parent_key TEXT NULL,
  parent_summary TEXT NULL,
  parent_type TEXT NULL,
  status TEXT NULL,
  created_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NULL,
  due_date TIMESTAMPTZ NULL,
  issue_type TEXT NULL,
  original_estimate_hours NUMERIC NULL,
  source_instance TEXT NULL,
  last_synced_at TIMESTAMPTZ NULL DEFAULT now(),
  project_key TEXT NULL,
  project_name TEXT NULL,
  space_id TEXT NULL,
  space_name TEXT NULL,
  folder_id TEXT NULL,
  folder_name TEXT NULL,
  url TEXT NULL
);

CREATE INDEX IF NOT EXISTS clickup_project_key_idx
  ON clickup (project_key);

CREATE INDEX IF NOT EXISTS clickup_space_id_idx
  ON clickup (space_id);

CREATE INDEX IF NOT EXISTS clickup_folder_id_idx
  ON clickup (folder_id);

COMMIT;
