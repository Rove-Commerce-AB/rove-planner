-- Free-text task description per time report row (same for all 7 days of a grid row).
ALTER TABLE time_report_entries
  ADD COLUMN IF NOT EXISTS task text;

COMMENT ON COLUMN time_report_entries.task IS 'Manual task description (what was done). One per grid row.';
