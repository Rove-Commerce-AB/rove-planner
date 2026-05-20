-- Point-in-time backup of time_report_entries (cell-level hours/comments).
-- Run against production/staging BEFORE hotfix deploy or duplicate cleanup.
--
-- Creates: public.time_report_entries_bak_<UTC_SUFFIX>
-- Optional companion tables (lines + revisions) are in backup_time_report_tables_pre_cleanup.sql
--
-- Restore single table (replace <suffix> with NOTICE output):
--   INSERT INTO time_report_entries SELECT * FROM time_report_entries_bak_<suffix>;
-- (Only safe after TRUNCATE or on empty table — understand FKs to entry_line_id first.)

DO $backup$
DECLARE
  suf text := to_char(timezone('UTC', now()), 'YYYYMMDD"T"HH24MISS"Z"');
  n_cells text := 'time_report_entries_bak_' || suf;
  n_lines text := 'time_report_entry_lines_bak_' || suf;
  row_count bigint;
BEGIN
  EXECUTE format(
    'CREATE TABLE public.%I AS TABLE public.time_report_entries',
    n_cells
  );
  EXECUTE format('SELECT count(*)::bigint FROM public.%I', n_cells) INTO row_count;
  EXECUTE format(
    'CREATE TABLE public.%I AS TABLE public.time_report_entry_lines',
    n_lines
  );
  EXECUTE format(
    'COMMENT ON TABLE public.%I IS %L',
    n_cells,
    'Backup of time_report_entries (' || suf || ' UTC), ' || row_count::text || ' rows.'
  );
  EXECUTE format(
    'COMMENT ON TABLE public.%I IS %L',
    n_lines,
    'Backup of time_report_entry_lines paired with entries backup (' || suf || ' UTC).'
  );
  RAISE NOTICE 'Backup tables created (UTC suffix %): public.% (% rows), public.%',
    suf, n_cells, row_count, n_lines;
END;
$backup$;
