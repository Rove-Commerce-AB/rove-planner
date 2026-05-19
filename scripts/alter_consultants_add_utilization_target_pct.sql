-- Per-person utilization target (%) for monthly budget follow-up in Reports.
-- NULL = no target set for that consultant.

ALTER TABLE consultants
  ADD COLUMN IF NOT EXISTS utilization_target_pct numeric(5, 2);

COMMENT ON COLUMN consultants.utilization_target_pct IS
  'Target billable utilization (% of month working hours) used in Reports budget comparison.';
