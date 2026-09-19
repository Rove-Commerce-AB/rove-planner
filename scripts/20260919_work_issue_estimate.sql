-- Estimate on Work issues + optional Time report link to a Work issue.
-- Logged hours are never stored on the card; they are summed from time_report_entries.
-- Safe to rerun.

BEGIN;

ALTER TABLE work_issues
  ADD COLUMN IF NOT EXISTS estimate_hours NUMERIC(8, 2);

ALTER TABLE work_issues
  DROP CONSTRAINT IF EXISTS work_issues_estimate_hours_check;
ALTER TABLE work_issues
  ADD CONSTRAINT work_issues_estimate_hours_check
  CHECK (estimate_hours IS NULL OR estimate_hours >= 0);

ALTER TABLE time_report_entry_lines
  ADD COLUMN IF NOT EXISTS work_issue_id UUID REFERENCES work_issues (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS time_report_entry_lines_work_issue_id_idx
  ON time_report_entry_lines (work_issue_id)
  WHERE work_issue_id IS NOT NULL;

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
    'estimate'
  ));

COMMIT;
