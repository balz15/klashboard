/*
  # Contest pokes (group nudges)

  Members can send lightweight nudges to other participants in the same challenge.
*/

CREATE TABLE IF NOT EXISTS contest_pokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contest_pokes_no_self CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS contest_pokes_contest_created_idx
  ON contest_pokes (contest_id, created_at DESC);

ALTER TABLE contest_pokes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contest_pokes_select_members"
  ON contest_pokes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = contest_pokes.contest_id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

CREATE POLICY "contest_pokes_insert_members"
  ON contest_pokes FOR INSERT TO authenticated
  WITH CHECK (
    from_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = contest_pokes.contest_id
        AND cp.user_id = from_user_id
        AND cp.left_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = contest_pokes.contest_id
        AND cp.user_id = to_user_id
        AND cp.left_at IS NULL
    )
  );
