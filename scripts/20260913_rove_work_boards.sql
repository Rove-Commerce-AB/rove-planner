-- Rove Work boards + allow customer users to be granted the Work app.
-- Safe to rerun. Does not grant Work to anyone.
--
-- Rules:
--   work_boards belong to a customer (including the internal Rove customer)
--   work_board_members restrict visibility for internal-customer boards
--   customer users may receive the Work app only (not Planner / Time report / Insights)

BEGIN;

CREATE TABLE IF NOT EXISTS work_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_by_app_user_id UUID NOT NULL REFERENCES app_users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_boards_customer_id_idx
  ON work_boards (customer_id);

CREATE TABLE IF NOT EXISTS work_board_members (
  board_id UUID NOT NULL REFERENCES work_boards (id) ON DELETE CASCADE,
  app_user_id UUID NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, app_user_id)
);

CREATE INDEX IF NOT EXISTS work_board_members_app_user_id_idx
  ON work_board_members (app_user_id);

DROP TRIGGER IF EXISTS trg_work_boards_updated_at ON work_boards;
CREATE TRIGGER trg_work_boards_updated_at
  BEFORE UPDATE ON work_boards
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

CREATE OR REPLACE FUNCTION enforce_customer_user_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'customer_app_users' THEN
    IF EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = NEW.customer_id AND c.is_internal
    ) THEN
      RAISE EXCEPTION 'Customer users cannot be linked to the internal customer'
        USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM app_users u
      WHERE u.id = NEW.app_user_id AND u.role = 'customer'
    ) THEN
      RAISE EXCEPTION 'Only customer-role users can be linked to a customer'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1 FROM consultants c
      WHERE c.app_user_id = NEW.app_user_id
    ) THEN
      RAISE EXCEPTION 'A consultant cannot also be a customer user'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'consultants' THEN
    IF NEW.app_user_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM app_users u
      WHERE u.id = NEW.app_user_id AND u.role = 'customer'
    ) THEN
      RAISE EXCEPTION 'A customer user cannot have a consultant profile'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'app_users' THEN
    IF NEW.role = 'customer' AND EXISTS (
      SELECT 1 FROM consultants c WHERE c.app_user_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'A consultant cannot also be a customer user'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'customers' THEN
    IF NEW.contact_app_user_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM customer_app_users cau
        WHERE cau.customer_id = NEW.id
          AND cau.app_user_id = NEW.contact_app_user_id
      ) THEN
        RAISE EXCEPTION 'Contact must be a customer user assigned to this customer'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'app_user_apps' THEN
    IF EXISTS (
      SELECT 1 FROM app_users u
      WHERE u.id = NEW.app_user_id AND u.role = 'customer'
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM apps a
        WHERE a.id = NEW.app_id AND a.key = 'work'
      ) THEN
        RAISE EXCEPTION 'Customer users can only be granted the Work app'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

SELECT to_regclass('work_boards') AS work_boards,
       to_regclass('work_board_members') AS work_board_members;
