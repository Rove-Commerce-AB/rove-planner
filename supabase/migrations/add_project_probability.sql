-- Add probability column to projects (1–100, default 100).
-- Existing rows get 100. New projects default to 100.

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS probability integer;

UPDATE projects
SET probability = 100
WHERE probability IS NULL;

ALTER TABLE projects
ALTER COLUMN probability SET DEFAULT 100;

-- Enforce 1–100 and disallow null
ALTER TABLE projects
ALTER COLUMN probability SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_probability_range'
  ) THEN
    ALTER TABLE projects
    ADD CONSTRAINT projects_probability_range CHECK (probability >= 1 AND probability <= 100);
  END IF;
END $$;
