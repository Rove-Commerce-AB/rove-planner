-- Add optional budget to projects (either in hours or in money SEK).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_hours numeric;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_money numeric;

COMMENT ON COLUMN projects.budget_hours IS 'Optional budget in hours; shown in planning footer Tot view / Tot';
COMMENT ON COLUMN projects.budget_money IS 'Optional budget in SEK; shown in planning footer Revenue total Tot view / Tot';
