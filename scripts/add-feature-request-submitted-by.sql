-- Run in Supabase SQL Editor (or psql) to store who submitted each feature request.
-- submitted_by_email = email of the logged-in app user at submit time (from app_users).
-- Existing rows get NULL.

ALTER TABLE feature_requests
  ADD COLUMN IF NOT EXISTS submitted_by_email text;

COMMENT ON COLUMN feature_requests.submitted_by_email IS 'Email of the user who submitted this request (from app_users).';
