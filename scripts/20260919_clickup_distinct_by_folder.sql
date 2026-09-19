CREATE OR REPLACE FUNCTION get_distinct_clickup_projects()
RETURNS TABLE(project_key text, project_name text)
LANGUAGE sql
AS $$
  -- project_key = folder_id, project_name = folder_name (dropdown label)
  SELECT
    c.folder_id::text AS project_key,
    NULLIF(MAX(NULLIF(c.folder_name, '')), '')::text AS project_name
  FROM clickup c
  WHERE c.folder_id IS NOT NULL
    AND NULLIF(c.folder_id, '') IS NOT NULL
  GROUP BY c.folder_id
  ORDER BY COALESCE(NULLIF(MAX(NULLIF(c.folder_name, '')), ''), c.folder_id);
$$;
