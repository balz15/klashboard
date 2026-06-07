/*
  # Optimize RLS Policies - Part 2: Contest Participants

  1. Performance Optimization
    - Replace auth.uid() with (select auth.uid()) in all participant policies
    - Improves performance for participant management queries

  2. Updated Policies
    - User self-management policies
    - Admin participant management policies
*/

DROP POLICY IF EXISTS "Users can update their participation" ON contest_participants;
CREATE POLICY "Users can update their participation"
  ON contest_participants FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can remove themselves" ON contest_participants;
CREATE POLICY "Users can remove themselves"
  ON contest_participants FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can join contests as participants" ON contest_participants;
CREATE POLICY "Users can join contests as participants"
  ON contest_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND role = 'participant'
  );

DROP POLICY IF EXISTS "Admins can add participants and co-admins" ON contest_participants;
CREATE POLICY "Admins can add participants and co-admins"
  ON contest_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contests
      WHERE contests.id = contest_participants.contest_id
      AND (
        contests.creator_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM contest_participants cp
          WHERE cp.contest_id = contests.id
          AND cp.user_id = (select auth.uid())
          AND cp.role IN ('owner', 'co_admin')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Admins can remove participants" ON contest_participants;
CREATE POLICY "Admins can remove participants"
  ON contest_participants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contests
      WHERE contests.id = contest_participants.contest_id
      AND (
        contests.creator_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM contest_participants cp
          WHERE cp.contest_id = contests.id
          AND cp.user_id = (select auth.uid())
          AND cp.role IN ('owner', 'co_admin')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Admins can update participants" ON contest_participants;
CREATE POLICY "Admins can update participants"
  ON contest_participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contests
      WHERE contests.id = contest_participants.contest_id
      AND (
        contests.creator_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM contest_participants cp
          WHERE cp.contest_id = contests.id
          AND cp.user_id = (select auth.uid())
          AND cp.role = 'owner'
        )
      )
    )
  );