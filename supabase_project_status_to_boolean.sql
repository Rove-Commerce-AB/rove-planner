-- Migrate projects.status (text: 'active'|'archived') to is_active (boolean)
-- Run this in Supabase SQL Editor

-- 1. Add new column
ALTER TABLE projects ADD COLUMN is_active boolean DEFAULT true;

-- 2. Migrate existing data (active = true, archived = false)
UPDATE projects SET is_active = (status = 'active');

-- 3. Make NOT NULL (after migration)
ALTER TABLE projects ALTER COLUMN is_active SET NOT NULL;

-- 4. Drop old column
ALTER TABLE projects DROP COLUMN status;
