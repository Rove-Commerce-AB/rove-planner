-- Allocation history: who added/updated/deleted allocations and when.
-- Run this once on your database.

CREATE TABLE IF NOT EXISTS allocation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'bulk')),
  changed_by_email text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NULL
);

CREATE INDEX IF NOT EXISTS allocation_history_changed_at_idx
  ON allocation_history (changed_at DESC);

CREATE INDEX IF NOT EXISTS allocation_history_allocation_id_idx
  ON allocation_history (allocation_id)
  WHERE allocation_id IS NOT NULL;

COMMENT ON TABLE allocation_history IS 'Audit log for allocation create/update/delete';
COMMENT ON COLUMN allocation_history.details IS 'For action=bulk: { "allocation_ids": ["uuid", ...] }';
