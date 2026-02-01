-- Add color and logo_url to customers table
-- Run this in Supabase SQL Editor

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS logo_url text;
