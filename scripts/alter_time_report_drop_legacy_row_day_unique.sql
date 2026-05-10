-- Remove legacy uniqueness on time_report_entries that predates entry_line_id.
-- After alter_time_report_concurrency.sql, uniqueness per calendar cell must be
-- (consultant_id, entry_line_id, entry_date) only. An old constraint such as
-- (consultant_id, customer_id, project_id, role_id, entry_date, ...) causes
-- duplicate-key errors when two logical lines (different entry_line_id) share
-- the same dimensions on the same day — which is valid in the new model.
--
-- Data safety: This script NEVER deletes, truncates, or updates rows in
-- time_report_entries. It only drops UNIQUE constraints and UNIQUE indexes.
-- In PostgreSQL those operations remove enforcement/metadata only; heap rows
-- stay untouched. (If something depends on a dropped constraint, DROP may ERROR
-- instead of silently removing data — fix dependencies first.)
--
-- Optional sanity check (run before and after; counts must match):
--   SELECT COUNT(*) AS time_report_entries_rows FROM public.time_report_entries;
--
-- Safe to run once per database; skips constraints/indexes that mention entry_line_id.

DO $$
DECLARE
  r RECORD;
  def TEXT;
BEGIN
  FOR r IN
    SELECT c.oid, c.conname
    FROM pg_constraint c
    INNER JOIN pg_class t ON t.oid = c.conrelid
    INNER JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'time_report_entries'
      AND c.contype = 'u'
  LOOP
    def := pg_get_constraintdef(r.oid);
    IF def LIKE '%entry_line_id%' THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.time_report_entries DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'Dropped unique constraint %', r.conname;
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'time_report_entries'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexname NOT LIKE '%_pkey'
      AND indexdef NOT ILIKE '%entry_line_id%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indexname);
    RAISE NOTICE 'Dropped unique index %', r.indexname;
  END LOOP;
END $$;
