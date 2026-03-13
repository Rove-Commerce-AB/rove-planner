-- Time report entries: one row per day per grid row (consultant + customer + project + role + jira_devops_key).
-- Plan: time_report_supabase_tables (en rad per dag).

CREATE TABLE IF NOT EXISTS time_report_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id uuid NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  jira_devops_key text,
  entry_date date NOT NULL,
  hours numeric(4,2) NOT NULL DEFAULT 0,
  comment text,
  rate_snapshot numeric(10,2),
  display_order smallint NOT NULL DEFAULT 0,
  pm_edited_hours numeric,
  pm_edited_comment text,
  pm_edited_at timestamptz,
  pm_edited_by uuid REFERENCES consultants(id) ON DELETE SET NULL,
  invoiced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(consultant_id, customer_id, project_id, role_id, jira_devops_key, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_time_report_entries_consultant_entry_date
  ON time_report_entries(consultant_id, entry_date);

CREATE INDEX IF NOT EXISTS idx_time_report_entries_entry_date
  ON time_report_entries(entry_date);

COMMENT ON TABLE time_report_entries IS 'One row per day per grid row (consultant + customer + project + role + jira).';
COMMENT ON COLUMN time_report_entries.entry_date IS 'Rapportdagen (kalenderdatum för denna rad).';
COMMENT ON COLUMN time_report_entries.rate_snapshot IS 'Raten vid sparande, SEK.';
COMMENT ON COLUMN time_report_entries.pm_edited_hours IS 'Konsultens timmar innan PM-redigering.';
COMMENT ON COLUMN time_report_entries.pm_edited_comment IS 'Konsultens kommentar innan PM-redigering.';

-- RLS: enable. Consultant scoping is enforced in server actions (getConsultantForCurrentUser).
-- This policy allows authenticated users; restrict to own consultant when app_users.consultant_id exists.
ALTER TABLE time_report_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage time_report_entries"
  ON time_report_entries
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
