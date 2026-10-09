-- Pre-deploy checklist items on work issues.
-- Safe to rerun.

BEGIN;

CREATE TABLE IF NOT EXISTS work_issue_pre_deploy_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES work_issues (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_issue_pre_deploy_actions_issue_id_idx
  ON work_issue_pre_deploy_actions (issue_id, sort_order, created_at);

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
    'reference',
    'sprint',
    'schedule',
    'type',
    'component',
    'pre_deploy'
  ));

COMMIT;
