BEGIN;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS clickup_project_id TEXT;

CREATE INDEX IF NOT EXISTS projects_clickup_project_id_idx
  ON projects (clickup_project_id)
  WHERE clickup_project_id IS NOT NULL;

CREATE OR REPLACE FUNCTION get_distinct_clickup_projects()
RETURNS TABLE(project_key text, project_name text)
LANGUAGE sql
AS $$
  SELECT DISTINCT
    c.project_key::text AS project_key,
    NULLIF(MAX(NULLIF(c.project_name, '')), '')::text AS project_name
  FROM clickup c
  WHERE c.project_key IS NOT NULL
    AND NULLIF(c.project_key, '') IS NOT NULL
  GROUP BY c.project_key
  ORDER BY c.project_key;
$$;

COMMIT;
