-- Read-only preflight for scripts/20260911_people_app_access.sql.

SELECT
  current_database() AS database_name,
  current_user AS database_user,
  inet_server_addr()::text AS server_address;

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

WITH unique_users AS (
  SELECT lower(trim(email)) AS normalized_email
  FROM app_users
  WHERE nullif(trim(email), '') IS NOT NULL
  GROUP BY lower(trim(email))
  HAVING count(*) = 1
),
unique_consultants AS (
  SELECT lower(trim(email)) AS normalized_email
  FROM consultants
  WHERE nullif(trim(email), '') IS NOT NULL
  GROUP BY lower(trim(email))
  HAVING count(*) = 1
)
SELECT count(*)::int AS safe_email_links
FROM unique_users
INNER JOIN unique_consultants USING (normalized_email);

SELECT
  (SELECT count(*)::int FROM app_users) AS app_users,
  (SELECT count(*)::int FROM consultants) AS consultants;
