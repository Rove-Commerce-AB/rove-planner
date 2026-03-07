-- Check allocation totals and find duplicates (run in Supabase SQL Editor).
-- Replace MY_PROJECT_ID with the actual project id (e.g. from the URL /projects/xxx).

-- 1) Duplicates: same (consultant_id, project_id, year, week, role_id) more than once
SELECT
  consultant_id,
  project_id,
  year,
  week,
  role_id,
  COUNT(*) AS row_count,
  SUM(hours) AS total_hours
FROM allocations
WHERE project_id = 'MY_PROJECT_ID'
GROUP BY consultant_id, project_id, year, week, role_id
HAVING COUNT(*) > 1;

-- 2) Totals per consultant on project, broken down by role (explains "Tot" column)
SELECT
  c.name AS consultant_name,
  a.role_id,
  r.name AS role_name,
  COUNT(*) AS allocation_rows,
  SUM(a.hours) AS sum_hours
FROM allocations a
JOIN consultants c ON c.id = a.consultant_id
LEFT JOIN roles r ON r.id = a.role_id
WHERE a.project_id = 'MY_PROJECT_ID'
GROUP BY c.id, c.name, a.role_id, r.name
ORDER BY c.name, a.role_id;

-- 3) Raw rows for one consultant (e.g. Anders Dovberg) – uncomment and set name
-- SELECT a.id, a.year, a.week, a.role_id, r.name AS role_name, a.hours
-- FROM allocations a
-- LEFT JOIN roles r ON r.id = a.role_id
-- JOIN consultants c ON c.id = a.consultant_id
-- WHERE a.project_id = 'MY_PROJECT_ID' AND c.name ILIKE '%Anders Dovberg%'
-- ORDER BY a.year, a.week;
