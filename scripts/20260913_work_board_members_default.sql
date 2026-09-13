-- Backfill Work board members from people linked to the customer.
-- Also keeps the board creator. Safe to rerun.

BEGIN;

INSERT INTO work_board_members (board_id, app_user_id)
SELECT DISTINCT b.id, people.app_user_id
FROM work_boards b
JOIN LATERAL (
  SELECT c.app_user_id
  FROM customer_consultants cc
  JOIN consultants c ON c.id = cc.consultant_id
  WHERE cc.customer_id = b.customer_id
    AND c.app_user_id IS NOT NULL
  UNION
  SELECT cau.app_user_id
  FROM customer_app_users cau
  WHERE cau.customer_id = b.customer_id
  UNION
  SELECT b.created_by_app_user_id
) people ON true
ON CONFLICT DO NOTHING;

COMMIT;
