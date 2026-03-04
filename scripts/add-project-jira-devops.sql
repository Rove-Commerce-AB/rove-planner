-- Add Jira/DevOps project link to projects.
-- A Rove project can optionally be linked to either one Jira project (project_key)
-- or one DevOps project (project name). Run in Supabase SQL Editor (or psql).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS jira_project_key text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS devops_project text;

COMMENT ON COLUMN projects.jira_project_key IS 'Optional link to jira_issues.project_key';
COMMENT ON COLUMN projects.devops_project IS 'Optional link to devops_work_items.project';
