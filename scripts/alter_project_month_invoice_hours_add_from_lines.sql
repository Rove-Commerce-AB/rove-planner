-- Persisted sum from time_report_entries for the month (PM hour when set, else reported).
-- One row per (project, year, month); optional invoiced_hours_fixed overrides for billing.

ALTER TABLE project_month_invoice_hours
  ADD COLUMN IF NOT EXISTS invoiced_hours_from_lines numeric(14, 4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN project_month_invoice_hours.invoiced_hours_from_lines IS
  'Sum of COALESCE(pm_edited_hours, hours) for the month; refreshed when PM opens Time approval.';

COMMENT ON COLUMN project_month_invoice_hours.invoiced_hours_fixed IS
  'When set, this amount is used for invoicing instead of invoiced_hours_from_lines.';
