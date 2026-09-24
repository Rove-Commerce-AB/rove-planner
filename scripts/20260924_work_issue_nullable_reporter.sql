-- Allow Work issues without a reporter (created_by).
-- Feature requests from unknown emails migrate with null reporter.
-- Safe to rerun.

BEGIN;

ALTER TABLE work_issues
  ALTER COLUMN created_by_app_user_id DROP NOT NULL;

COMMIT;
