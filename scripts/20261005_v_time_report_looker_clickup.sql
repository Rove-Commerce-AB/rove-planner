-- Include ClickUp tasks in the Looker time-report export.
-- Entries store links as jira_devops_key = 'clickup:<clickup_id>'.
-- ClickUp values are coalesced into existing Jira* columns so Looker
-- charts that use JiraKeyAndSummary / JiraType / JiraEstimate keep working.
-- Dedicated ClickUp* columns are appended at the end (CREATE OR REPLACE
-- VIEW cannot insert/rename columns in the middle of an existing view).
--
-- Matches production column order, including EntryCreatedAt / LateEntry.
-- If a DB was previously updated without those columns, use:
--   DROP VIEW IF EXISTS v_time_report_looker;
-- before running this script.

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
  r.name AS "RoleName",
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
