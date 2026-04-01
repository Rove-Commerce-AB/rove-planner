-- Align DB with application: src/lib/timeReportEntries.ts and projectManagerTimeReport.ts
-- select/insert use column "internal_comment". The initial table migration used "comment".

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'time_report_entries'
      AND column_name = 'comment'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'time_report_entries'
      AND column_name = 'internal_comment'
  ) THEN
    ALTER TABLE public.time_report_entries RENAME COLUMN comment TO internal_comment;
  END IF;
END $$;

COMMENT ON COLUMN public.time_report_entries.internal_comment IS
  'Per-day internal comment on consultant time report entries.';
