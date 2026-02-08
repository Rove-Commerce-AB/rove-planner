-- Junction table: consultants assigned to a customer.
-- Used to limit which projects are available when allocating a consultant (Add Allocation).
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS customer_consultants (
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  consultant_id uuid NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, consultant_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_consultants_consultant_id
  ON customer_consultants(consultant_id);
