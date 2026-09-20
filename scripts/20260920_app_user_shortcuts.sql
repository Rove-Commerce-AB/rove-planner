-- Per-user navigation shortcuts (sidebar + breadcrumb star).
-- Safe to rerun.

BEGIN;

CREATE TABLE IF NOT EXISTS app_user_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id UUID NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  href TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_user_shortcuts_name_not_blank CHECK (char_length(trim(name)) > 0),
  CONSTRAINT app_user_shortcuts_name_length CHECK (char_length(name) <= 80),
  CONSTRAINT app_user_shortcuts_href_format CHECK (href ~ '^/')
);

CREATE INDEX IF NOT EXISTS app_user_shortcuts_user_created_idx
  ON app_user_shortcuts (app_user_id, created_at);

COMMIT;
