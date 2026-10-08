-- Work issue type (issue|bug) and per-project components.
-- Safe to rerun.

BEGIN;

CREATE TABLE IF NOT EXISTS work_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES work_projects (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT work_components_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS work_components_project_name_uidx
  ON work_components (project_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS work_components_project_id_idx
  ON work_components (project_id);

DROP TRIGGER IF EXISTS trg_work_components_updated_at ON work_components;
CREATE TRIGGER trg_work_components_updated_at
  BEFORE UPDATE ON work_components
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE work_issues
  ADD COLUMN IF NOT EXISTS issue_type TEXT NOT NULL DEFAULT 'issue';

ALTER TABLE work_issues
  DROP CONSTRAINT IF EXISTS work_issues_issue_type_check;
ALTER TABLE work_issues
  ADD CONSTRAINT work_issues_issue_type_check
  CHECK (issue_type IN ('issue', 'bug'));

ALTER TABLE work_issues
  ADD COLUMN IF NOT EXISTS component_id UUID;

ALTER TABLE work_issues
  DROP CONSTRAINT IF EXISTS work_issues_component_id_fkey;
ALTER TABLE work_issues
  ADD CONSTRAINT work_issues_component_id_fkey
  FOREIGN KEY (component_id) REFERENCES work_components (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS work_issues_component_id_idx
  ON work_issues (component_id)
  WHERE component_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS work_issues_issue_type_idx
  ON work_issues (project_id, issue_type);

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
    'component'
  ));

COMMIT;
