-- Add birth_date to consultants (optional, admin-only visibility in app).
ALTER TABLE consultants
  ADD COLUMN IF NOT EXISTS birth_date date;

COMMENT ON COLUMN consultants.birth_date IS 'Consultant birth date. Shown only to admin users.';
