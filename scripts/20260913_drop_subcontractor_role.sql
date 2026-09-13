-- Drop app_users.role = subcontractor.
--
-- Underkonsult is consultants.is_external. Login rights are admin / member /
-- customer plus app_user_apps. Safe to rerun.
--
-- Run in dev first:
--   node --env-file=.env.local scripts/run-sql-file.mjs scripts/20260913_drop_subcontractor_role.sql

BEGIN;

UPDATE consultants c
SET is_external = true,
    updated_at = now()
FROM app_users u
WHERE c.app_user_id = u.id
  AND u.role IN ('subcontractor', 'underkonsult')
  AND c.is_external IS DISTINCT FROM true;

UPDATE app_users
SET role = 'member',
    updated_at = now()
WHERE role IN ('subcontractor', 'underkonsult');

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
  CHECK (role IN ('admin', 'member', 'customer'));

SELECT role, count(*) AS users
FROM app_users
GROUP BY role
ORDER BY role;

SELECT count(*) FILTER (WHERE is_external) AS external_consultants,
       count(*) FILTER (WHERE NOT is_external) AS internal_consultants
FROM consultants;

COMMIT;
