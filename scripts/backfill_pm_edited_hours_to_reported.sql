-- Backfill: PM hours (pm_edited_hours) = reported hours (hours) for every row.
-- Run once against your Cloud SQL / Postgres database (e.g. psql, Cloud Console).
--
-- WARNING: This overwrites any existing PM hour adjustments. Take a backup first
-- if you need to preserve old pm_edited_hours values.
--
-- After this, new inserts from the app already set pm_edited_hours = hours; PMs
-- can still change PM hours from My projects as before.

BEGIN;

UPDATE time_report_entries
SET pm_edited_hours = hours;

-- Optional: inspect counts before COMMIT
-- SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE pm_edited_hours = hours) AS matching_hours FROM time_report_entries;

COMMIT;
