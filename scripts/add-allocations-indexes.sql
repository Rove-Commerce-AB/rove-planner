-- Performance: indexes on allocations for faster reads.
-- Safe to run multiple times (IF NOT EXISTS).
-- No behavior change; queries return the same data, just faster.

-- 1) getAllocationsForWeeks / getAllocationsForWeekRange: filter by year + week range
CREATE INDEX IF NOT EXISTS idx_allocations_year_week
  ON allocations (year, week);

-- 2) findExistingAllocation: lookup by consultant, project, year, week (and role_id in filter)
CREATE INDEX IF NOT EXISTS idx_allocations_consultant_project_year_week
  ON allocations (consultant_id, project_id, year, week);
