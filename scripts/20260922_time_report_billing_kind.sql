-- Billing kind for time cells described as (unpaid).
-- Stored so monthly invoice totals can skip them (Time report month view and Time approval).
-- Expression must stay aligned with unpaidTimeEntrySql() in src/lib/unpaidTimeEntry.ts.
-- Safe to rerun. Generated column: do not INSERT it. Existing rows are classified on add.
-- Adding a stored generated column rewrites time_report_entries (brief exclusive lock).

BEGIN;

ALTER TABLE time_report_entries
  ADD COLUMN IF NOT EXISTS billing_kind text
  GENERATED ALWAYS AS (
    CASE
      WHEN COALESCE(description, '') ~* '\(\s*unpaid\s*\)'
        OR COALESCE(internal_comment, '') ~* '\(\s*unpaid\s*\)'
      THEN 'unpaid'
      ELSE 'billable'
    END
  ) STORED;

COMMENT ON COLUMN time_report_entries.billing_kind IS
  'billable or unpaid. unpaid when description or internal_comment contains (unpaid). Excluded from monthly invoice hour totals.';

COMMIT;
