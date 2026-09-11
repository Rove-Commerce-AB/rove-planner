-- Customer users: login accounts that belong to customers, never Rove apps.
--
-- Safe to rerun. Does not backfill people. Run in dev first, then production.
--
-- Rules:
--   app_users.role may be customer
--   customer users have no Planner / Time report / Insights grants
--   customer users cannot have a consultant profile
--   customer_app_users never references the internal (Rove) customer
--   customers.contact_app_user_id must be a customer user on that customer

BEGIN;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = current_schema()
      AND rel.relname = 'app_users'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ~* '\yrole\y'
  LOOP
    EXECUTE format('ALTER TABLE app_users DROP CONSTRAINT %I', rec.conname);
  END LOOP;
END
$$;

ALTER TABLE app_users
  ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('admin', 'member', 'subcontractor', 'customer'));

CREATE TABLE IF NOT EXISTS customer_app_users (
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, app_user_id)
);

CREATE INDEX IF NOT EXISTS customer_app_users_app_user_id_idx
  ON customer_app_users(app_user_id);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS contact_app_user_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customers_contact_app_user_id_fkey'
      AND conrelid = 'customers'::regclass
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_contact_app_user_id_fkey
      FOREIGN KEY (contact_app_user_id)
      REFERENCES app_users(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS customers_contact_app_user_id_idx
  ON customers(contact_app_user_id)
  WHERE contact_app_user_id IS NOT NULL;

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
      RAISE EXCEPTION 'Customer users cannot be granted Rove apps'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_app_users_enforce ON customer_app_users;
CREATE TRIGGER customer_app_users_enforce
  BEFORE INSERT OR UPDATE ON customer_app_users
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_customer_user_rules();

DROP TRIGGER IF EXISTS consultants_customer_user_enforce ON consultants;
CREATE TRIGGER consultants_customer_user_enforce
  BEFORE INSERT OR UPDATE OF app_user_id ON consultants
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_customer_user_rules();

DROP TRIGGER IF EXISTS app_users_customer_role_enforce ON app_users;
CREATE TRIGGER app_users_customer_role_enforce
  BEFORE INSERT OR UPDATE OF role ON app_users
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_customer_user_rules();

DROP TRIGGER IF EXISTS customers_contact_user_enforce ON customers;
CREATE TRIGGER customers_contact_user_enforce
  BEFORE INSERT OR UPDATE OF contact_app_user_id ON customers
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_customer_user_rules();

DROP TRIGGER IF EXISTS app_user_apps_customer_user_enforce ON app_user_apps;
CREATE TRIGGER app_user_apps_customer_user_enforce
  BEFORE INSERT OR UPDATE ON app_user_apps
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_customer_user_rules();

CREATE OR REPLACE FUNCTION clear_customer_contact_on_unlink()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE customers
  SET contact_app_user_id = NULL,
      updated_at = now()
  WHERE id = OLD.customer_id
    AND contact_app_user_id = OLD.app_user_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS customer_app_users_clear_contact ON customer_app_users;
CREATE TRIGGER customer_app_users_clear_contact
  AFTER DELETE ON customer_app_users
  FOR EACH ROW
  EXECUTE PROCEDURE clear_customer_contact_on_unlink();

COMMIT;

-- Verification: role constraint includes customer.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'app_users'::regclass
  AND conname = 'app_users_role_check';

-- Verification: table exists.
SELECT count(*)::int AS customer_app_user_rows FROM customer_app_users;
