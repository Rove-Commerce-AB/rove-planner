-- Whether customer-role users may see estimates and reported time on Work boards.
-- Default off. Rove (non-customer) users are unaffected.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS work_show_time_to_customer_users boolean NOT NULL DEFAULT false;
