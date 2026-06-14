-- One-time repair: ensure every challenge creator has an admin participant row.
-- Run after grant/RLS fixes if challenges were created while setup was broken.

INSERT INTO contest_participants (contest_id, user_id, role)
SELECT c.id, c.creator_id, 'admin'
FROM contests c
WHERE NOT EXISTS (
  SELECT 1 FROM contest_participants cp
  WHERE cp.contest_id = c.id
    AND cp.user_id = c.creator_id
    AND cp.left_at IS NULL
);
