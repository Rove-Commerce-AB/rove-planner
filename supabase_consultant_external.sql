-- Add is_external to consultants table
-- Run this in Supabase SQL Editor

ALTER TABLE consultants
  ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false;
