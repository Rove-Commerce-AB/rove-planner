-- Add is_active to customers table
-- Run this in Supabase SQL Editor

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
