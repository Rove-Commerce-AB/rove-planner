-- Customer status: single append-only table (traffic light + comment per row).
-- Run manually against your Postgres database (e.g. psql, Cloud Console).
-- There is no migration runner in this repo; apply once per environment.
--
-- If you never ran the old two-table script, this file is all you need.
-- If customer_status_traffic / customer_status_comments already exist, take a
-- backup, run this file first (creates customer_status_entries), then run once:
--   scripts/migrate_customer_status_legacy_to_entries.sql

BEGIN;

CREATE TABLE IF NOT EXISTS customer_status_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  traffic_light TEXT NOT NULL CHECK (traffic_light IN ('red', 'yellow', 'green')),
  body TEXT NOT NULL,
  year INT NOT NULL,
  week INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_status_entries_customer_id_created_at_idx
  ON customer_status_entries (customer_id, created_at DESC);

COMMIT;
