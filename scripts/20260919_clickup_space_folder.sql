-- Add ClickUp Space and Folder to synced tasks.
BEGIN;

ALTER TABLE clickup
  ADD COLUMN IF NOT EXISTS space_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS space_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS folder_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS folder_name TEXT NULL;

CREATE INDEX IF NOT EXISTS clickup_space_id_idx ON clickup (space_id);
CREATE INDEX IF NOT EXISTS clickup_folder_id_idx ON clickup (folder_id);

COMMIT;
