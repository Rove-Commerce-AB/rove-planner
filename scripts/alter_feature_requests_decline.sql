-- Add decline metadata for feature requests.
-- Run against the app database when deploying this feature.

ALTER TABLE feature_requests
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decline_comment TEXT;
