-- Run in Supabase SQL Editor (or psql) to mark feature requests as implemented.
-- Implemented requests are shown at the bottom with a light green background in Settings.

ALTER TABLE feature_requests
  ADD COLUMN IF NOT EXISTS is_implemented boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN feature_requests.is_implemented IS 'When true, the feature request is implemented; shown at bottom with green background.';
