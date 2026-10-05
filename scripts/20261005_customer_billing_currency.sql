-- Customer billing currency (SEK/EUR) and time-report currency snapshot.
-- New rates inherit customers.billing_currency. Historical rate_snapshot values
-- stay as stored; currency_snapshot is set going forward (existing rows = SEK).

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS billing_currency text NOT NULL DEFAULT 'SEK';

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_billing_currency_check;

ALTER TABLE customers
  ADD CONSTRAINT customers_billing_currency_check
  CHECK (billing_currency IN ('SEK', 'EUR'));

ALTER TABLE time_report_entries
  ADD COLUMN IF NOT EXISTS currency_snapshot text;

ALTER TABLE time_report_entries
  DROP CONSTRAINT IF EXISTS time_report_entries_currency_snapshot_check;

ALTER TABLE time_report_entries
  ADD CONSTRAINT time_report_entries_currency_snapshot_check
  CHECK (currency_snapshot IS NULL OR currency_snapshot IN ('SEK', 'EUR'));

UPDATE time_report_entries
SET currency_snapshot = 'SEK'
WHERE currency_snapshot IS NULL AND rate_snapshot IS NOT NULL;
