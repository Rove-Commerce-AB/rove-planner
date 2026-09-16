BEGIN;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'time_and_material';

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS fixed_price numeric;

UPDATE projects
SET billing_type = 'time_and_material'
WHERE billing_type IS NULL
   OR billing_type NOT IN ('time_and_material', 'fixed_price');

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_billing_type_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_billing_type_check
  CHECK (billing_type IN ('time_and_material', 'fixed_price'));

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_fixed_price_required;

ALTER TABLE projects
  ADD CONSTRAINT projects_fixed_price_required
  CHECK (
    billing_type <> 'fixed_price'
    OR (fixed_price IS NOT NULL AND fixed_price > 0)
  );

COMMIT;
