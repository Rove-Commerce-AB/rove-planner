-- Add Rove Work to the app catalogue so it can be granted in Settings → People.
-- Safe to rerun. Does not grant the app to any existing users.

BEGIN;

INSERT INTO apps (key, name)
VALUES ('work', 'Work')
ON CONFLICT (key) DO NOTHING;

COMMIT;

SELECT key, name
FROM apps
ORDER BY key;
