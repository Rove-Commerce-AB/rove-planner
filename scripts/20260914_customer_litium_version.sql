-- Litium subscription id (6-char match key) and reported platform version.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS subscription_id text,
  ADD COLUMN IF NOT EXISTS litium_version text;

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_subscription_id_length_chk;

ALTER TABLE customers
  ADD CONSTRAINT customers_subscription_id_length_chk
  CHECK (
    subscription_id IS NULL
    OR char_length(subscription_id) = 6
  );

CREATE UNIQUE INDEX IF NOT EXISTS customers_subscription_id_lower_idx
  ON customers (lower(subscription_id))
  WHERE subscription_id IS NOT NULL;
