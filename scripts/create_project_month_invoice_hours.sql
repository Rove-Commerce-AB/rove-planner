-- One row per project + calendar month: stored line sum + optional fixed override (Time approval).

CREATE TABLE IF NOT EXISTS project_month_invoice_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year >= 2000 AND year <= 3000),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  invoiced_hours_from_lines numeric(14, 4) NOT NULL DEFAULT 0,
  invoiced_hours_fixed numeric(14, 4),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES consultants (id),
  CONSTRAINT project_month_invoice_hours_project_ym_unique UNIQUE (project_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_project_month_invoice_hours_project
  ON project_month_invoice_hours (project_id);
