-- Project billing type: hourly (default) vs fixed price.
-- Fixed-price projects still track hours for margin; Looker Income is 0
-- (contract value lives on projects.budget_money, not hours × rate).

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'hourly';

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_billing_type_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_billing_type_check
  CHECK (billing_type IN ('hourly', 'fixed'));

COMMENT ON COLUMN projects.billing_type IS
  'hourly = T&M (hours × rate); fixed = contract value in budget_money, Income 0 in Looker';

-- ---------------------------------------------------------------------------
-- Looker: Income = 0 for fixed-price projects
-- DROP required: REPLACE cannot change column types / insert BillingType mid-list
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_time_report_looker;

CREATE VIEW v_time_report_looker AS
SELECT
  tre.id,
  tre.entry_date AS "EntryDate",
  to_char(tre.entry_date::timestamptz, 'YYYY-MM') AS "EntryDateYYYYMM",
  date_trunc('week', tre.entry_date::timestamptz) AS "EntryWeek",
  tre.hours AS "Hours",
  COALESCE(tre.pm_edited_hours, tre.hours) AS "SumOfHours",
  CASE
    WHEN p.billing_type = 'fixed' THEN NULL::numeric(10,2)
    ELSE tre.rate_snapshot
  END AS "Rate",
  CASE
    WHEN p.billing_type = 'fixed' THEN 0::numeric
    ELSE COALESCE(tre.pm_edited_hours, tre.hours)
      * COALESCE(tre.rate_snapshot, 0::numeric)
  END AS "Income",
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
  p.billing_type AS "BillingType",
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
