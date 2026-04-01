-- Allow multiple consultant grid rows per (customer, project, role, jira, day) by scoping
-- uniqueness with display_order (one logical row uses the same display_order for all 7 days).

DO $$
DECLARE
  con_name text;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'time_report_entries'
      AND c.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.time_report_entries DROP CONSTRAINT %I', con_name);
  END LOOP;
END $$;

ALTER TABLE public.time_report_entries
  ADD CONSTRAINT time_report_entries_grid_cell_unique
  UNIQUE (consultant_id, customer_id, project_id, role_id, jira_devops_key, entry_date, display_order);
