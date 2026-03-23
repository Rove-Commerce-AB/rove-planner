-- Add project manager (consultant) reference to projects.
-- A project can optionally have a dedicated project manager; this is not tied to allocations.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_manager_id uuid;

COMMENT ON COLUMN projects.project_manager_id
  IS 'Optional link to consultants.id for the project manager / owner';

