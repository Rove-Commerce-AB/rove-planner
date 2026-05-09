-- Add a customer classification flag so "internal house customer" logic
-- is driven by data instead of a hardcoded customer name.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

-- Backfill current internal customer to preserve existing behavior.
-- This can be adjusted manually if another customer should be internal.
UPDATE customers
SET is_internal = true
WHERE lower(name) = lower('Rove');

-- Optional guard: keep at most one internal customer.
CREATE UNIQUE INDEX IF NOT EXISTS customers_single_internal_idx
  ON customers ((is_internal))
  WHERE is_internal = true;
