-- Issue priority + acceptance criteria (Requirements tab).
-- Safe to rerun.

BEGIN;

ALTER TABLE work_issues
  ADD COLUMN IF NOT EXISTS priority TEXT;

ALTER TABLE work_issues
  DROP CONSTRAINT IF EXISTS work_issues_priority_check;
ALTER TABLE work_issues
  ADD CONSTRAINT work_issues_priority_check
  CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high'));

CREATE TABLE IF NOT EXISTS work_issue_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES work_issues (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_issue_requirements_issue_id_idx
  ON work_issue_requirements (issue_id, sort_order, created_at);

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
    'file',
    'relation',
    'estimate',
    'priority',
    'requirement'
  ));

COMMIT;
