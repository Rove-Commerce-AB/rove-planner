-- Consultant employment period: start_date and end_date (nullable).
-- Weeks before start or after end are shown as unavailable (gray) in the allocation sheet;
-- bookings can still be added for those weeks.

ALTER TABLE consultants
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date;

COMMENT ON COLUMN consultants.start_date IS 'First day consultant is available. Null = no start limit.';
COMMENT ON COLUMN consultants.end_date IS 'Last day consultant is available. Null = no end limit.';
