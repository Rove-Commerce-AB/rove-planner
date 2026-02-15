-- Allow allocations without an assigned consultant ("To plan").
-- Run this once on your database.

ALTER TABLE allocations
  ALTER COLUMN consultant_id DROP NOT NULL;

-- Optional: ensure NULL consultant_id sorts first when ordering by consultant_id
-- (e.g. "To plan" row at top). Default in Postgres is NULLS FIRST for ASC.
-- No change needed unless you use NULLS LAST elsewhere.
