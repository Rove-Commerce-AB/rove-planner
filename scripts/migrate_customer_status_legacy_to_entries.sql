-- One-time migration: legacy customer_status_traffic + customer_status_comments
-- → customer_status_entries (append-only). Run only after:
--   1) Backup the database.
--   2) scripts/create_customer_status.sql (creates customer_status_entries).
--
-- Safe to skip entirely if those legacy tables were never created.
-- Do not re-run after legacy tables are dropped (inserts would duplicate if you
-- recreated legacy data manually).

BEGIN;

INSERT INTO customer_status_entries (customer_id, traffic_light, body, year, week, created_at)
SELECT
  c.customer_id,
  COALESCE(
    (SELECT t.traffic_light FROM customer_status_traffic t WHERE t.customer_id = c.customer_id),
    'yellow'
  ),
  c.body,
  c.year,
  c.week,
  c.created_at
FROM customer_status_comments c;

INSERT INTO customer_status_entries (customer_id, traffic_light, body, year, week, created_at)
SELECT
  t.customer_id,
  t.traffic_light,
  'Migrated: prior traffic-only row (no stored comment).',
  to_char(t.updated_at AT TIME ZONE 'UTC', 'IYYY')::int,
  to_char(t.updated_at AT TIME ZONE 'UTC', 'IW')::int,
  t.updated_at
FROM customer_status_traffic t
WHERE NOT EXISTS (
  SELECT 1 FROM customer_status_comments c WHERE c.customer_id = t.customer_id
);

DROP TABLE IF EXISTS customer_status_comments;
DROP TABLE IF EXISTS customer_status_traffic;

COMMIT;
