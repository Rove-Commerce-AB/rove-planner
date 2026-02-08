-- Project-specific rates. Override customer rates when present.
-- Effective rate: project rate if exists, else customer rate.
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS project_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  rate_per_hour numeric NOT NULL,
  currency text NOT NULL DEFAULT 'SEK',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_project_rates_project_id ON project_rates(project_id);
CREATE INDEX IF NOT EXISTS idx_project_rates_role_id ON project_rates(role_id);
