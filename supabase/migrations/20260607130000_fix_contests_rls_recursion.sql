/*
  # Fix infinite recursion on contests SELECT policy

  The "Users can view contests" policy queried contest_participants directly.
  contest_participants policies call user_is_contest_creator(), which reads contests
  again → infinite recursion.

  Use user_is_in_contest() (SECURITY DEFINER) instead of a subquery on contest_participants.
*/

DROP POLICY IF EXISTS "Users can view contests" ON contests;

CREATE POLICY "Users can view contests"
  ON contests
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    OR creator_id = auth.uid()
    OR invite_code IS NOT NULL
    OR user_is_in_contest(id, auth.uid())
  );
