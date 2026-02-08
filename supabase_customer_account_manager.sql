-- Add Account Manager to customers (references consultants).
-- Run after consultants table exists.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS account_manager_id uuid REFERENCES consultants(id) ON DELETE SET NULL;

COMMENT ON COLUMN customers.account_manager_id IS 'Consultant who is account manager for this customer.';
