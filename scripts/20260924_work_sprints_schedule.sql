-- Work sprints + issue schedule dates (Sprint mode + Timeline).
-- Safe to rerun.

BEGIN;

CREATE TABLE IF NOT EXISTS work_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES work_boards (id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status TEXT NOT NULL,
  capacity_hours NUMERIC(8, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT work_sprints_number_positive CHECK (number >= 1),
  CONSTRAINT work_sprints_date_range CHECK (ends_on >= starts_on),
  CONSTRAINT work_sprints_status_check CHECK (status IN ('current', 'next', 'completed')),
  CONSTRAINT work_sprints_capacity_check CHECK (
    capacity_hours IS NULL OR capacity_hours >= 0
  ),
  UNIQUE (board_id, number)
);

CREATE INDEX IF NOT EXISTS work_sprints_board_status_idx
  ON work_sprints (board_id, status, starts_on);

CREATE UNIQUE INDEX IF NOT EXISTS work_sprints_one_current_idx
  ON work_sprints (board_id)
  WHERE status = 'current';

CREATE UNIQUE INDEX IF NOT EXISTS work_sprints_one_next_idx
  ON work_sprints (board_id)
  WHERE status = 'next';

ALTER TABLE work_issues
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES work_sprints (id) ON DELETE SET NULL;

ALTER TABLE work_issues
  ADD COLUMN IF NOT EXISTS start_date DATE;

ALTER TABLE work_issues
  ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE work_issues
  DROP CONSTRAINT IF EXISTS work_issues_schedule_range_check;
ALTER TABLE work_issues
  ADD CONSTRAINT work_issues_schedule_range_check
  CHECK (
    start_date IS NULL
    OR due_date IS NULL
    OR due_date >= start_date
  );

CREATE INDEX IF NOT EXISTS work_issues_sprint_id_idx
  ON work_issues (sprint_id)
  WHERE sprint_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS work_issues_schedule_idx
  ON work_issues (board_id, start_date, due_date);

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
    'schedule'
  ));

COMMIT;
