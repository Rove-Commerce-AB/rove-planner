-- Add work_percentage to consultants table
-- 100 = full-time, 80 = 80% (e.g. 32h available on 40h week)
-- Run this in Supabase SQL Editor

ALTER TABLE consultants
  ADD COLUMN IF NOT EXISTS work_percentage smallint NOT NULL DEFAULT 100;

-- Optional: ensure values are between 5 and 100 (5% steps handled in UI)
ALTER TABLE consultants
  DROP CONSTRAINT IF EXISTS consultants_work_percentage_range;

ALTER TABLE consultants
  ADD CONSTRAINT consultants_work_percentage_range
  CHECK (work_percentage >= 5 AND work_percentage <= 100);
