-- RPCs for distinct Jira/DevOps projects (used by project integration dropdown).
-- Avoids fetching thousands of issue rows; returns only unique project keys/names.

CREATE OR REPLACE FUNCTION get_distinct_jira_projects()
RETURNS TABLE (project_key text, project_name text)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (ji.project_key) ji.project_key, ji.project_name
  FROM jira_issues ji
  WHERE ji.project_key IS NOT NULL AND trim(ji.project_key) <> ''
  ORDER BY ji.project_key, ji.project_name NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION get_distinct_devops_projects()
RETURNS TABLE (project text)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT dw.project
  FROM devops_work_items dw
  WHERE dw.project IS NOT NULL AND trim(dw.project) <> ''
  ORDER BY dw.project;
$$;
