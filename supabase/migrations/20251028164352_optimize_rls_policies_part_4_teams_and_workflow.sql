/*
  # Optimize RLS Policies - Part 4: Teams and Submission Workflow

  1. Performance Optimization
    - Optimizes policies for contest_teams, team_members
    - Optimizes policies for submission_config, metric_submissions
    - Optimizes policies for contest_member_exits

  2. Updated Tables
    - contest_teams
    - team_members
    - submission_config
    - metric_submissions
    - contest_member_exits
*/

-- ============================================================================
-- CONTEST_TEAMS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Contest participants can view teams" ON contest_teams;
CREATE POLICY "Contest participants can view teams"
  ON contest_teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.contest_id = contest_teams.contest_id
      AND contest_participants.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can manage teams" ON contest_teams;
CREATE POLICY "Admins can manage teams"
  ON contest_teams
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contests
      WHERE contests.id = contest_teams.contest_id
      AND (
        contests.creator_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM contest_participants
          WHERE contest_participants.contest_id = contests.id
          AND contest_participants.user_id = (select auth.uid())
          AND contest_participants.role IN ('owner', 'co_admin')
        )
      )
    )
  );

-- ============================================================================
-- TEAM_MEMBERS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Contest participants can view team members" ON team_members;
CREATE POLICY "Contest participants can view team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_teams
      JOIN contest_participants ON contest_participants.contest_id = contest_teams.contest_id
      WHERE contest_teams.id = team_members.team_id
      AND contest_participants.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins and captains can manage team members" ON team_members;
CREATE POLICY "Admins and captains can manage team members"
  ON team_members
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_teams
      JOIN contests ON contests.id = contest_teams.contest_id
      WHERE contest_teams.id = team_members.team_id
      AND (
        contests.creator_id = (select auth.uid())
        OR contest_teams.captain_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM contest_participants
          WHERE contest_participants.contest_id = contests.id
          AND contest_participants.user_id = (select auth.uid())
          AND contest_participants.role IN ('owner', 'co_admin')
        )
      )
    )
  );

-- ============================================================================
-- SUBMISSION_CONFIG TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Contest participants can view submission config" ON submission_config;
CREATE POLICY "Contest participants can view submission config"
  ON submission_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.contest_id = submission_config.contest_id
      AND contest_participants.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can manage submission config" ON submission_config;
CREATE POLICY "Admins can manage submission config"
  ON submission_config
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contests
      WHERE contests.id = submission_config.contest_id
      AND (
        contests.creator_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM contest_participants
          WHERE contest_participants.contest_id = contests.id
          AND contest_participants.user_id = (select auth.uid())
          AND contest_participants.role IN ('owner', 'co_admin')
        )
      )
    )
  );

-- ============================================================================
-- METRIC_SUBMISSIONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Participants can view submissions in their contest" ON metric_submissions;
CREATE POLICY "Participants can view submissions in their contest"
  ON metric_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.contest_id = metric_submissions.contest_id
      AND contest_participants.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can create own submissions" ON metric_submissions;
CREATE POLICY "Participants can create own submissions"
  ON metric_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    participant_id IN (
      SELECT id FROM contest_participants
      WHERE user_id = (select auth.uid())
      AND contest_id = metric_submissions.contest_id
    )
  );

DROP POLICY IF EXISTS "Participants can update own pending submissions" ON metric_submissions;
CREATE POLICY "Participants can update own pending submissions"
  ON metric_submissions FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND participant_id IN (
      SELECT id FROM contest_participants
      WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    status = 'pending'
    AND participant_id IN (
      SELECT id FROM contest_participants
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Captains and admins can approve submissions" ON metric_submissions;
CREATE POLICY "Captains and admins can approve submissions"
  ON metric_submissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contests
      WHERE contests.id = metric_submissions.contest_id
      AND (
        contests.creator_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM contest_participants
          WHERE contest_participants.contest_id = contests.id
          AND contest_participants.user_id = (select auth.uid())
          AND contest_participants.role IN ('owner', 'co_admin', 'captain')
        )
      )
    )
  );

-- ============================================================================
-- CONTEST_MEMBER_EXITS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own exit records" ON contest_member_exits;
CREATE POLICY "Users can view own exit records"
  ON contest_member_exits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.id = contest_member_exits.participant_id
      AND contest_participants.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create own exit records" ON contest_member_exits;
CREATE POLICY "Users can create own exit records"
  ON contest_member_exits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.id = contest_member_exits.participant_id
      AND contest_participants.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can view all exit records for their contests" ON contest_member_exits;
CREATE POLICY "Admins can view all exit records for their contests"
  ON contest_member_exits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contests
      WHERE contests.id = contest_member_exits.contest_id
      AND (
        contests.creator_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM contest_participants
          WHERE contest_participants.contest_id = contests.id
          AND contest_participants.user_id = (select auth.uid())
          AND contest_participants.role IN ('owner', 'co_admin')
        )
      )
    )
  );