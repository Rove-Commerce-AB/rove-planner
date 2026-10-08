-- Custom customer/project tasks (rates without a global roles row).
-- role_id stays the link to Settings → Roles; custom rows use name instead.
-- Historical time_report_entries.rate_snapshot / currency_snapshot are not rewritten.

-- ---------------------------------------------------------------------------
-- customer_rates
-- ---------------------------------------------------------------------------
ALTER TABLE customer_rates
  ALTER COLUMN role_id DROP NOT NULL;

ALTER TABLE customer_rates
  ADD COLUMN IF NOT EXISTS name text;

ALTER TABLE customer_rates
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE customer_rates
  DROP CONSTRAINT IF EXISTS customer_rates_customer_id_role_id_key;

DROP INDEX IF EXISTS customer_rates_customer_id_role_id_key;

ALTER TABLE customer_rates
  DROP CONSTRAINT IF EXISTS customer_rates_role_or_name_check;

ALTER TABLE customer_rates
  ADD CONSTRAINT customer_rates_role_or_name_check
  CHECK (
    (role_id IS NOT NULL AND name IS NULL)
    OR (
      role_id IS NULL
      AND name IS NOT NULL
      AND length(btrim(name)) > 0
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS customer_rates_customer_role_uidx
  ON customer_rates (customer_id, role_id)
  WHERE role_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_rates_customer_name_uidx
  ON customer_rates (customer_id, lower(btrim(name)))
  WHERE role_id IS NULL;

-- ---------------------------------------------------------------------------
-- project_rates
-- ---------------------------------------------------------------------------
ALTER TABLE project_rates
  ALTER COLUMN role_id DROP NOT NULL;

ALTER TABLE project_rates
  ADD COLUMN IF NOT EXISTS name text;

ALTER TABLE project_rates
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE project_rates
  DROP CONSTRAINT IF EXISTS project_rates_project_id_role_id_key;

DROP INDEX IF EXISTS project_rates_project_id_role_id_key;

ALTER TABLE project_rates
  DROP CONSTRAINT IF EXISTS project_rates_role_or_name_check;

ALTER TABLE project_rates
  ADD CONSTRAINT project_rates_role_or_name_check
  CHECK (
    (role_id IS NOT NULL AND name IS NULL)
    OR (
      role_id IS NULL
      AND name IS NOT NULL
      AND length(btrim(name)) > 0
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS project_rates_project_role_uidx
  ON project_rates (project_id, role_id)
  WHERE role_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS project_rates_project_name_uidx
  ON project_rates (project_id, lower(btrim(name)))
  WHERE role_id IS NULL;

-- ---------------------------------------------------------------------------
-- time_report_entry_lines
-- ---------------------------------------------------------------------------
ALTER TABLE time_report_entry_lines
  ADD COLUMN IF NOT EXISTS customer_rate_id uuid REFERENCES customer_rates (id) ON DELETE RESTRICT;

ALTER TABLE time_report_entry_lines
  ADD COLUMN IF NOT EXISTS project_rate_id uuid REFERENCES project_rates (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS time_report_entry_lines_customer_rate_id_idx
  ON time_report_entry_lines (customer_rate_id)
  WHERE customer_rate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS time_report_entry_lines_project_rate_id_idx
  ON time_report_entry_lines (project_rate_id)
  WHERE project_rate_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- time_report_entries
-- ---------------------------------------------------------------------------
ALTER TABLE time_report_entries
  ALTER COLUMN role_id DROP NOT NULL;

ALTER TABLE time_report_entries
  ADD COLUMN IF NOT EXISTS customer_rate_id uuid REFERENCES customer_rates (id) ON DELETE RESTRICT;

ALTER TABLE time_report_entries
  ADD COLUMN IF NOT EXISTS project_rate_id uuid REFERENCES project_rates (id) ON DELETE RESTRICT;

ALTER TABLE time_report_entries
  ADD COLUMN IF NOT EXISTS role_name_snapshot text;

CREATE INDEX IF NOT EXISTS time_report_entries_customer_rate_id_idx
  ON time_report_entries (customer_rate_id)
  WHERE customer_rate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS time_report_entries_project_rate_id_idx
  ON time_report_entries (project_rate_id)
  WHERE project_rate_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS time_report_entries_custom_customer_rate_day_uidx
  ON time_report_entries (
    consultant_id,
    customer_rate_id,
    COALESCE(jira_devops_key, ''),
    entry_date
  )
  WHERE customer_rate_id IS NOT NULL AND role_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS time_report_entries_custom_project_rate_day_uidx
  ON time_report_entries (
    consultant_id,
    project_rate_id,
    COALESCE(jira_devops_key, ''),
    entry_date
  )
  WHERE project_rate_id IS NOT NULL AND role_id IS NULL;

-- ---------------------------------------------------------------------------
-- allocations
-- ---------------------------------------------------------------------------
ALTER TABLE allocations
  ADD COLUMN IF NOT EXISTS customer_rate_id uuid REFERENCES customer_rates (id) ON DELETE RESTRICT;

ALTER TABLE allocations
  ADD COLUMN IF NOT EXISTS project_rate_id uuid REFERENCES project_rates (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS allocations_customer_rate_id_idx
  ON allocations (customer_rate_id)
  WHERE customer_rate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS allocations_project_rate_id_idx
  ON allocations (project_rate_id)
  WHERE project_rate_id IS NOT NULL;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'allocations'
      AND c.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE allocations DROP CONSTRAINT IF EXISTS %I', rec.conname);
  END LOOP;
END $$;

DROP INDEX IF EXISTS allocations_consultant_project_week_role_uidx;
DROP INDEX IF EXISTS allocations_consultant_project_week_no_role_uidx;
DROP INDEX IF EXISTS allocations_unique_consultant_project_year_week_role;
DROP INDEX IF EXISTS allocations_unique_consultant_project_year_week;

CREATE UNIQUE INDEX IF NOT EXISTS allocations_consultant_project_week_role_uidx
  ON allocations (consultant_id, project_id, year, week, role_id)
  WHERE role_id IS NOT NULL AND consultant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS allocations_consultant_project_week_customer_rate_uidx
  ON allocations (consultant_id, project_id, year, week, customer_rate_id)
  WHERE customer_rate_id IS NOT NULL AND consultant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS allocations_consultant_project_week_project_rate_uidx
  ON allocations (consultant_id, project_id, year, week, project_rate_id)
  WHERE project_rate_id IS NOT NULL AND consultant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS allocations_consultant_project_week_no_task_uidx
  ON allocations (consultant_id, project_id, year, week)
  WHERE role_id IS NULL
    AND customer_rate_id IS NULL
    AND project_rate_id IS NULL
    AND consultant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS allocations_to_plan_project_week_role_uidx
  ON allocations (project_id, year, week, role_id)
  WHERE role_id IS NOT NULL AND consultant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS allocations_to_plan_project_week_customer_rate_uidx
  ON allocations (project_id, year, week, customer_rate_id)
  WHERE customer_rate_id IS NOT NULL AND consultant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS allocations_to_plan_project_week_project_rate_uidx
  ON allocations (project_id, year, week, project_rate_id)
  WHERE project_rate_id IS NOT NULL AND consultant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS allocations_to_plan_project_week_no_task_uidx
  ON allocations (project_id, year, week)
  WHERE role_id IS NULL
    AND customer_rate_id IS NULL
    AND project_rate_id IS NULL
    AND consultant_id IS NULL;

-- ---------------------------------------------------------------------------
-- Looker: RoleName from snapshot for custom tasks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_time_report_looker AS
SELECT
  tre.id,
  tre.entry_date AS "EntryDate",
  to_char(tre.entry_date::timestamptz, 'YYYY-MM') AS "EntryDateYYYYMM",
  date_trunc('week', tre.entry_date::timestamptz) AS "EntryWeek",
  tre.hours AS "Hours",
  COALESCE(tre.pm_edited_hours, tre.hours) AS "SumOfHours",
  tre.rate_snapshot AS "Rate",
  COALESCE(tre.pm_edited_hours, tre.hours)
    * COALESCE(tre.rate_snapshot, 0::numeric) AS "Income",
  tre.internal_comment AS "EntryNote",
  c.id::text AS "ConsultantId",
  c.name AS "ConsultantName",
  c.is_external AS "ExternalConsultant",
  cu.id::text AS "CustomerId",
  cu.name AS "CustomerName",
  cu.account_manager_id::text AS "AccountManagerId",
  am.name AS "AccountManagerName",
  p.id::text AS "ProjectId",
  p.name AS "ProjectName",
  p.project_manager_id::text AS "ProjectManagerId",
  pm.name AS "ProjectManagerName",
  r.id::text AS "RoleId",
  COALESCE(tre.role_name_snapshot, r.name) AS "RoleName",
  t.id::text AS "TeamId",
  t.name AS "TeamName",
  COALESCE(ji.jira_key, ck.clickup_id) AS "JiraKey",
  COALESCE(ji.summary, ck.summary) AS "JiraSummary",
  CASE
    WHEN ji.jira_key IS NOT NULL THEN
      (ji.jira_key || ' – ') || COALESCE(ji.summary, '')
    WHEN ck.clickup_id IS NOT NULL THEN
      (ck.clickup_id || ' – ') || COALESCE(ck.summary, '')
    ELSE NULL
  END AS "JiraKeyAndSummary",
  COALESCE(ji.parent_key, ck.parent_key) AS "JiraParentKey",
  COALESCE(ji.parent_summary, ck.parent_summary) AS "JiraParentSummary",
  CASE
    WHEN ji.parent_key IS NOT NULL THEN
      (ji.parent_key || ' – ') || COALESCE(ji.parent_summary, '')
    WHEN ck.parent_key IS NOT NULL THEN
      (ck.parent_key || ' – ') || COALESCE(ck.parent_summary, '')
    ELSE NULL
  END AS "JiraParentKeyAndSummary",
  COALESCE(ji.status, ck.status) AS "JiraStatus",
  COALESCE(ji.issue_type, ck.issue_type) AS "JiraType",
  COALESCE(ji.original_estimate_hours, ck.original_estimate_hours) AS "JiraEstimate",
  dw.work_item_id AS "DevOpsId",
  dw.title AS "DevOpsTitle",
  CASE
    WHEN dw.work_item_id IS NOT NULL THEN
      (dw.work_item_id::text || ' – ') || COALESCE(dw.title, '')
    ELSE NULL
  END AS "DevOpsIdAndTitle",
  dw.project AS "DevOpsProjectCode",
  tre.description AS "Description",
  tre.display_order AS "TaskId",
  CASE
    WHEN p.type = 'customer'::project_type THEN true
    ELSE false
  END AS "Billable",
  tre.pm_edited_hours AS "PMEditedHours",
  tre.pm_edited_comment AS "PMEditedComment",
  tre.created_at AS "EntryCreatedAt",
  date_trunc('month', tre.created_at)
    > date_trunc('month', tre.entry_date::timestamptz) AS "LateEntry",
  ck.clickup_id AS "ClickUpId",
  ck.summary AS "ClickUpSummary",
  CASE
    WHEN ck.clickup_id IS NOT NULL THEN
      (ck.clickup_id || ' – ') || COALESCE(ck.summary, '')
    ELSE NULL
  END AS "ClickUpIdAndSummary",
  ck.status AS "ClickUpStatus",
  ck.issue_type AS "ClickUpType",
  ck.original_estimate_hours AS "ClickUpEstimate",
  ck.url AS "ClickUpUrl",
  COALESCE(tre.currency_snapshot, cu.billing_currency, 'SEK') AS "Currency"
FROM time_report_entries tre
LEFT JOIN consultants c ON c.id = tre.consultant_id
LEFT JOIN customers cu ON cu.id = tre.customer_id
LEFT JOIN projects p ON p.id = tre.project_id
LEFT JOIN roles r ON r.id = tre.role_id
LEFT JOIN teams t ON t.id = c.team_id
LEFT JOIN consultants am ON am.id = cu.account_manager_id
LEFT JOIN consultants pm ON pm.id = p.project_manager_id
LEFT JOIN jira_issues ji
  ON ji.jira_key = regexp_replace(tre.jira_devops_key, '^jira:', '')
 AND tre.jira_devops_key LIKE 'jira:%'
LEFT JOIN clickup ck
  ON ck.clickup_id = regexp_replace(tre.jira_devops_key, '^clickup:', '')
 AND tre.jira_devops_key LIKE 'clickup:%'
LEFT JOIN devops_work_items dw
  ON dw.work_item_id::text = regexp_replace(tre.jira_devops_key, '^devops:', '')
 AND tre.jira_devops_key LIKE 'devops:%';
