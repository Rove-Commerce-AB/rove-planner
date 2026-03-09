-- Add url to customers table (website used for favicon in panel)
-- Run this in Supabase SQL Editor

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS url text;
