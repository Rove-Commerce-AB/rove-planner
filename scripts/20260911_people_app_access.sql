-- People + app access migration
--
-- Safe to rerun. Run first in dev/test, review the verification result sets,
-- then run the same file in production during a normal deployment window.
--
-- Existing access is preserved:
--   admin/member  -> Planner, Time report, Insights
--   subcontractor -> Time report

BEGIN;

CREATE TABLE IF NOT EXISTS apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT apps_key_format_check CHECK (key ~ '^[a-z][a-z0-9_]*$')
);

INSERT INTO apps (key, name)
VALUES
  ('planner', 'Planner'),
  ('time_report', 'Time report'),
  ('insights', 'Insights')
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    updated_at = now();

CREATE TABLE IF NOT EXISTS app_user_apps (
  app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_user_id, app_id)
);

CREATE INDEX IF NOT EXISTS app_user_apps_app_id_idx
  ON app_user_apps(app_id);

ALTER TABLE consultants
  ADD COLUMN IF NOT EXISTS app_user_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'consultants_app_user_id_fkey'
      AND conrelid = 'consultants'::regclass
  ) THEN
    ALTER TABLE consultants
      ADD CONSTRAINT consultants_app_user_id_fkey
      FOREIGN KEY (app_user_id)
      REFERENCES app_users(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS consultants_app_user_id_uidx
  ON consultants(app_user_id)
  WHERE app_user_id IS NOT NULL;

-- Link only unambiguous one-to-one normalized email matches.
WITH unique_app_user_emails AS (
  SELECT lower(trim(email)) AS normalized_email, min(id::text)::uuid AS app_user_id
  FROM app_users
  WHERE nullif(trim(email), '') IS NOT NULL
  GROUP BY lower(trim(email))
  HAVING count(*) = 1
),
unique_consultant_emails AS (
  SELECT lower(trim(email)) AS normalized_email, min(id::text)::uuid AS consultant_id
  FROM consultants
  WHERE nullif(trim(email), '') IS NOT NULL
  GROUP BY lower(trim(email))
  HAVING count(*) = 1
),
safe_matches AS (
  SELECT u.app_user_id, c.consultant_id
  FROM unique_app_user_emails u
  INNER JOIN unique_consultant_emails c
    ON c.normalized_email = u.normalized_email
)
UPDATE consultants c
SET app_user_id = m.app_user_id,
    updated_at = now()
FROM safe_matches m
WHERE c.id = m.consultant_id
  AND c.app_user_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM consultants already_linked
    WHERE already_linked.app_user_id = m.app_user_id
  );

-- Backfill the access users effectively had before app grants existed.
INSERT INTO app_user_apps (app_user_id, app_id)
SELECT u.id, a.id
FROM app_users u
CROSS JOIN apps a
WHERE
  (u.role IN ('admin', 'member') AND a.key IN ('planner', 'time_report', 'insights'))
  OR
  (u.role = 'subcontractor' AND a.key = 'time_report')
ON CONFLICT (app_user_id, app_id) DO NOTHING;

COMMIT;

-- Verification 1: every login user must have at least one app.
SELECT
  u.id,
  u.email,
  u.role,
  count(aua.app_id)::int AS app_count
FROM app_users u
LEFT JOIN app_user_apps aua ON aua.app_user_id = u.id
GROUP BY u.id, u.email, u.role
HAVING count(aua.app_id) = 0
ORDER BY lower(u.email);

-- Verification 2: ambiguous normalized emails intentionally left for review.
WITH email_counts AS (
  SELECT
    normalized_email,
    sum(app_user_count)::int AS app_user_count,
    sum(consultant_count)::int AS consultant_count
  FROM (
    SELECT lower(trim(email)) AS normalized_email, count(*) AS app_user_count, 0 AS consultant_count
    FROM app_users
    WHERE nullif(trim(email), '') IS NOT NULL
    GROUP BY lower(trim(email))
    UNION ALL
    SELECT lower(trim(email)) AS normalized_email, 0 AS app_user_count, count(*) AS consultant_count
    FROM consultants
    WHERE nullif(trim(email), '') IS NOT NULL
    GROUP BY lower(trim(email))
  ) counts
  GROUP BY normalized_email
)
SELECT normalized_email, app_user_count, consultant_count
FROM email_counts
WHERE app_user_count > 1 OR consultant_count > 1
ORDER BY normalized_email;

-- Verification 3: matched and unmatched consultant profiles.
SELECT
  count(*) FILTER (WHERE app_user_id IS NOT NULL)::int AS linked_consultants,
  count(*) FILTER (WHERE app_user_id IS NULL)::int AS consultant_only_people
FROM consultants;
