-- Relations between issues on the same Work board.
-- Safe to rerun.

BEGIN;

CREATE TABLE IF NOT EXISTS work_issue_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES work_boards (id) ON DELETE CASCADE,
  from_issue_id UUID NOT NULL REFERENCES work_issues (id) ON DELETE CASCADE,
  to_issue_id UUID NOT NULL REFERENCES work_issues (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('blocks', 'relates', 'parent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT work_issue_relations_not_self CHECK (from_issue_id <> to_issue_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS work_issue_relations_edge_idx
  ON work_issue_relations (from_issue_id, to_issue_id, kind);

CREATE UNIQUE INDEX IF NOT EXISTS work_issue_relations_one_parent_idx
  ON work_issue_relations (to_issue_id)
  WHERE kind = 'parent';

CREATE INDEX IF NOT EXISTS work_issue_relations_board_id_idx
  ON work_issue_relations (board_id);

CREATE INDEX IF NOT EXISTS work_issue_relations_to_issue_id_idx
  ON work_issue_relations (to_issue_id);

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
