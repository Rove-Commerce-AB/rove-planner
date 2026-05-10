-- Full backup of time-report tables before running merge/dedup/delete cleanup scripts.
--
-- Creates three snapshot tables in public (names include UTC timestamp):
--   time_report_entry_lines_bak_<UTC>
--   time_report_entries_bak_<UTC>
--   time_report_week_revisions_bak_<UTC>
--
-- Optional fourth (often large): uncomment the EXECUTE block for history.
--
-- Restore pattern (example — replace <suffix> with printed suffix):
--   TRUNCATE time_report_entry_lines, time_report_entries, time_report_week_revisions CASCADE;
--   INSERT INTO time_report_entry_lines SELECT * FROM time_report_entry_lines_bak_<suffix>;
--   INSERT INTO time_report_entries SELECT * FROM time_report_entries_bak_<suffix>;
--   INSERT INTO time_report_week_revisions SELECT * FROM time_report_week_revisions_bak_<suffix>;
-- (Only use TRUNCATE if you fully trust the backup and understand FK/order implications.)
--
-- Alternative (recommended for ops): pg_dump for same tables
--   pg_dump "$DATABASE_URL" -t time_report_entry_lines -t time_report_entries \
--     -t time_report_week_revisions --data-only -Fc -f time_report_core_$(date -u +%Y%m%dT%H%M%SZ).dump

DO $backup$
DECLARE
  suf text := to_char(timezone('UTC', now()), 'YYYYMMDD"T"HH24MISS"Z"');
  n_lines text := 'time_report_entry_lines_bak_' || suf;
  n_cells text := 'time_report_entries_bak_' || suf;
  n_rev text := 'time_report_week_revisions_bak_' || suf;
BEGIN
  EXECUTE format(
    'CREATE TABLE public.%I AS SELECT * FROM public.time_report_entry_lines',
    n_lines
  );
  EXECUTE format(
    'CREATE TABLE public.%I AS SELECT * FROM public.time_report_entries',
    n_cells
  );
  EXECUTE format(
    'CREATE TABLE public.%I AS SELECT * FROM public.time_report_week_revisions',
    n_rev
  );

  EXECUTE format(
    'COMMENT ON TABLE public.%I IS %L',
    n_lines,
    'Backup snapshot of time_report_entry_lines before cleanup (' || suf || ' UTC).'
  );
  EXECUTE format(
    'COMMENT ON TABLE public.%I IS %L',
    n_cells,
    'Backup snapshot of time_report_entries before cleanup (' || suf || ' UTC).'
  );
  EXECUTE format(
    'COMMENT ON TABLE public.%I IS %L',
    n_rev,
    'Backup snapshot of time_report_week_revisions before cleanup (' || suf || ' UTC).'
  );

  -- Uncomment if you want a point-in-time copy of audit rows too (can be very large).
  -- EXECUTE format(
  --   'CREATE TABLE public.%I AS SELECT * FROM public.time_report_entries_history',
  --   'time_report_entries_history_bak_' || suf
  -- );

  RAISE NOTICE 'Created backup tables (UTC suffix %): public.%, public.%, public.%',
    suf, n_lines, n_cells, n_rev;
END;
$backup$;
