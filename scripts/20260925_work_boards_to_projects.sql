-- Rename Work boards → projects; optional link to Planner projects; preferred view.
-- Safe to rerun.

BEGIN;

-- ---------------------------------------------------------------------------
-- work_boards → work_projects
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'work_boards'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'work_projects'
  ) THEN
    ALTER TABLE work_boards RENAME TO work_projects;
  END IF;
END $$;

ALTER INDEX IF EXISTS work_boards_customer_id_idx
  RENAME TO work_projects_customer_id_idx;
ALTER INDEX IF EXISTS work_boards_customer_prefix_idx
  RENAME TO work_projects_customer_prefix_idx;
ALTER INDEX IF EXISTS work_boards_customer_active_idx
  RENAME TO work_projects_customer_active_idx;

DROP TRIGGER IF EXISTS trg_work_boards_updated_at ON work_projects;
DROP TRIGGER IF EXISTS trg_work_projects_updated_at ON work_projects;
CREATE TRIGGER trg_work_projects_updated_at
  BEFORE UPDATE ON work_projects
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

ALTER TABLE work_projects
  ADD COLUMN IF NOT EXISTS planner_project_id UUID REFERENCES projects (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS work_projects_planner_project_uidx
  ON work_projects (planner_project_id)
  WHERE planner_project_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- work_board_members → work_project_members
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'work_board_members'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'work_project_members'
  ) THEN
    ALTER TABLE work_board_members RENAME TO work_project_members;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_project_members'
      AND column_name = 'board_id'
  ) THEN
    ALTER TABLE work_project_members RENAME COLUMN board_id TO project_id;
  END IF;
END $$;

ALTER INDEX IF EXISTS work_board_members_app_user_id_idx
  RENAME TO work_project_members_app_user_id_idx;

ALTER TABLE work_project_members
  ADD COLUMN IF NOT EXISTS preferred_view TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_project_members_preferred_view_check'
  ) THEN
    ALTER TABLE work_project_members
      ADD CONSTRAINT work_project_members_preferred_view_check
      CHECK (
        preferred_view IS NULL
        OR preferred_view IN ('board', 'sprint', 'timeline')
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- work_board_statuses → work_project_statuses
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'work_board_statuses'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'work_project_statuses'
  ) THEN
    ALTER TABLE work_board_statuses RENAME TO work_project_statuses;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_project_statuses'
      AND column_name = 'board_id'
  ) THEN
    ALTER TABLE work_project_statuses RENAME COLUMN board_id TO project_id;
  END IF;
END $$;

ALTER INDEX IF EXISTS work_board_statuses_board_sort_idx
  RENAME TO work_project_statuses_project_sort_idx;

-- ---------------------------------------------------------------------------
-- Child tables: board_id → project_id
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_issues' AND column_name = 'board_id'
  ) THEN
    ALTER TABLE work_issues RENAME COLUMN board_id TO project_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_sprints' AND column_name = 'board_id'
  ) THEN
    ALTER TABLE work_sprints RENAME COLUMN board_id TO project_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_issue_labels'
      AND column_name = 'board_id'
  ) THEN
    ALTER TABLE work_issue_labels RENAME COLUMN board_id TO project_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_issue_relations'
      AND column_name = 'board_id'
  ) THEN
    ALTER TABLE work_issue_relations RENAME COLUMN board_id TO project_id;
  END IF;
END $$;

-- Rename common indexes if present (skip no-op same-name renames)
ALTER INDEX IF EXISTS work_issues_board_id_number_key
  RENAME TO work_issues_project_id_number_key;
ALTER INDEX IF EXISTS work_issues_board_status_sort_idx
  RENAME TO work_issues_project_status_sort_idx;
ALTER INDEX IF EXISTS work_sprints_board_number_key
  RENAME TO work_sprints_project_number_key;
ALTER INDEX IF EXISTS work_sprints_board_status_idx
  RENAME TO work_sprints_project_status_idx;
ALTER INDEX IF EXISTS work_issue_labels_board_name_uidx
  RENAME TO work_issue_labels_project_name_uidx;
ALTER INDEX IF EXISTS work_issue_relations_board_id_idx
  RENAME TO work_issue_relations_project_id_idx;

-- Status FK still points at renamed table (OID); recreate name clarity optional.
-- work_issues.status still references work_project_statuses.id.

COMMIT;
