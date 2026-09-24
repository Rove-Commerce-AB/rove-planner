-- Requirements tab: definition of done, out of scope, linked references.
-- Safe to rerun.

BEGIN;

ALTER TABLE work_issues
  ADD COLUMN IF NOT EXISTS out_of_scope TEXT NOT NULL DEFAULT '';

ALTER TABLE work_issue_requirements
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'acceptance';

ALTER TABLE work_issue_requirements
  DROP CONSTRAINT IF EXISTS work_issue_requirements_kind_check;
ALTER TABLE work_issue_requirements
  ADD CONSTRAINT work_issue_requirements_kind_check
  CHECK (kind IN ('acceptance', 'dod'));

CREATE INDEX IF NOT EXISTS work_issue_requirements_issue_kind_idx
  ON work_issue_requirements (issue_id, kind, sort_order, created_at);

CREATE TABLE IF NOT EXISTS work_issue_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES work_issues (id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_issue_references_issue_id_idx
  ON work_issue_references (issue_id, sort_order, created_at);

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
    'requirement',
    'out_of_scope',
    'reference'
  ));

COMMIT;
