-- Run this in Supabase SQL Editor (or psql) to add project probability.
-- Existing projects get 100%. New projects default to 100%.

-- 1) Add column (ignore error if it already exists)
ALTER TABLE projects ADD COLUMN probability integer;

-- 2) Set existing rows to 100
UPDATE projects SET probability = 100 WHERE probability IS NULL;

-- 3) Default for new rows
ALTER TABLE projects ALTER COLUMN probability SET DEFAULT 100;

-- 4) Disallow null
ALTER TABLE projects ALTER COLUMN probability SET NOT NULL;

-- 5) Constraint 1–100 (skip if you get "constraint already exists")
ALTER TABLE projects ADD CONSTRAINT projects_probability_range CHECK (probability >= 1 AND probability <= 100);
