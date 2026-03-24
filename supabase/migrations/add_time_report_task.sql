-- Free-text description per time report row (same for all 7 days of a grid row).
ALTER TABLE time_report_entries
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN time_report_entries.description IS 'Manual description (what was done). One per grid row.';
