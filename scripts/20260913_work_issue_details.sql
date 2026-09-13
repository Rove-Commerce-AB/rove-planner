-- Issue drawer fields: owner, assignees, labels, comments, activity, files.
-- Safe to rerun.

BEGIN;

ALTER TABLE work_issues
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID NULL REFERENCES app_users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS current_state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS next_step TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS work_issue_assignees (
  issue_id UUID NOT NULL REFERENCES work_issues (id) ON DELETE CASCADE,
  app_user_id UUID NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, app_user_id)
);

CREATE INDEX IF NOT EXISTS work_issue_assignees_app_user_id_idx
  ON work_issue_assignees (app_user_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'work_issues'
      AND column_name = 'assigned_to_app_user_id'
  ) THEN
    UPDATE work_issues
    SET owner_app_user_id = COALESCE(
      owner_app_user_id,
      assigned_to_app_user_id,
      created_by_app_user_id
    )
    WHERE owner_app_user_id IS NULL;

    INSERT INTO work_issue_assignees (issue_id, app_user_id)
    SELECT id, assigned_to_app_user_id
    FROM work_issues
    WHERE assigned_to_app_user_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    ALTER TABLE work_issues DROP COLUMN assigned_to_app_user_id;
  ELSE
    UPDATE work_issues
    SET owner_app_user_id = COALESCE(owner_app_user_id, created_by_app_user_id)
    WHERE owner_app_user_id IS NULL;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS work_issue_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES work_boards (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS work_issue_labels_board_name_idx
  ON work_issue_labels (board_id, lower(name));

CREATE TABLE IF NOT EXISTS work_issue_label_links (
  issue_id UUID NOT NULL REFERENCES work_issues (id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES work_issue_labels (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, label_id)
);

CREATE TABLE IF NOT EXISTS work_issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES work_issues (id) ON DELETE CASCADE,
  author_app_user_id UUID NOT NULL REFERENCES app_users (id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_issue_comments_issue_id_idx
  ON work_issue_comments (issue_id, created_at);

CREATE TABLE IF NOT EXISTS work_issue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES work_issues (id) ON DELETE CASCADE,
  actor_app_user_id UUID NOT NULL REFERENCES app_users (id) ON DELETE RESTRICT,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE work_issue_events
  DROP CONSTRAINT IF EXISTS work_issue_events_kind_check;
ALTER TABLE work_issue_events
  ADD CONSTRAINT work_issue_events_kind_check
  CHECK (kind IN (
    'created',
    'title',
    'status',
    'owner',
    'assignees',
    'labels',
    'description',
    'current_state',
    'next_step',
    'comment',
    'file'
  ));

CREATE INDEX IF NOT EXISTS work_issue_events_issue_id_idx
  ON work_issue_events (issue_id, created_at);

CREATE TABLE IF NOT EXISTS work_issue_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES work_issues (id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  content BYTEA NOT NULL,
  uploaded_by_app_user_id UUID NOT NULL REFERENCES app_users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_issue_files_issue_id_idx
  ON work_issue_files (issue_id, created_at);

COMMIT;

SELECT to_regclass('work_issue_comments') AS comments,
       to_regclass('work_issue_files') AS files;
