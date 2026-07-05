-- Time-report lookup indexes for load/save/PM review paths.
--
-- Run each statement outside an explicit transaction. PostgreSQL does not allow
-- CREATE INDEX CONCURRENTLY inside BEGIN/COMMIT.

CREATE INDEX CONCURRENTLY IF NOT EXISTS time_report_entries_consultant_entry_date_idx
  ON time_report_entries (consultant_id, entry_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS time_report_entries_project_entry_date_idx
  ON time_report_entries (project_id, entry_date);
