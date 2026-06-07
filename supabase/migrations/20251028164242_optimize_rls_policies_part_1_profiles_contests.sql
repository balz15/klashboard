/*
  # Optimize RLS Policies - Part 1: Profiles and Contests

  1. Performance Optimization
    - Replace auth.uid() with (select auth.uid()) in RLS policies
    - Prevents re-evaluation of auth context for each row
    - Significantly improves query performance at scale

  2. Updated Tables
    - profiles: Insert and update policies
    - contests: All CRUD policies
*/

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- ============================================================================
-- CONTESTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can create contests" ON contests;
CREATE POLICY "Users can create contests"
  ON contests FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = (select auth.uid()));

DROP POLICY IF EXISTS "Contest creators can update contests" ON contests;
CREATE POLICY "Contest creators can update contests"
  ON contests FOR UPDATE
  TO authenticated
  USING (creator_id = (select auth.uid()))
  WITH CHECK (creator_id = (select auth.uid()));

DROP POLICY IF EXISTS "Contest creators can delete contests" ON contests;
CREATE POLICY "Contest creators can delete contests"
  ON contests FOR DELETE
  TO authenticated
  USING (creator_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view contests" ON contests;
CREATE POLICY "Users can view contests"
  ON contests FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    OR creator_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.contest_id = contests.id
      AND contest_participants.user_id = (select auth.uid())
    )
  );