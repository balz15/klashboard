/*
  # Optimize RLS Policies - Part 3: Submissions, Templates, and Related Tables

  1. Performance Optimization
    - Optimizes policies for submissions, templates, template_purchases
    - Optimizes policies for prize_contributions, notifications, analytics

  2. Updated Tables
    - submissions
    - templates
    - template_purchases
    - prize_contributions
    - notifications
    - analytics_events
*/

-- ============================================================================
-- SUBMISSIONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can create submissions" ON submissions;
CREATE POLICY "Users can create submissions"
  ON submissions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own submissions" ON submissions;
CREATE POLICY "Users can view own submissions"
  ON submissions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own submissions" ON submissions;
CREATE POLICY "Users can update own submissions"
  ON submissions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- TEMPLATES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view approved templates" ON templates;
CREATE POLICY "Users can view approved templates"
  ON templates FOR SELECT
  TO authenticated
  USING (approved_at IS NOT NULL OR creator_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create templates" ON templates;
CREATE POLICY "Users can create templates"
  ON templates FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = (select auth.uid()));

DROP POLICY IF EXISTS "Creators can update templates" ON templates;
CREATE POLICY "Creators can update templates"
  ON templates FOR UPDATE
  TO authenticated
  USING (creator_id = (select auth.uid()))
  WITH CHECK (creator_id = (select auth.uid()));

-- ============================================================================
-- TEMPLATE_PURCHASES TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own purchases" ON template_purchases;
CREATE POLICY "Users can view own purchases"
  ON template_purchases FOR SELECT
  TO authenticated
  USING (buyer_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create purchases" ON template_purchases;
CREATE POLICY "Users can create purchases"
  ON template_purchases FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = (select auth.uid()));

-- ============================================================================
-- PRIZE_CONTRIBUTIONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can contribute" ON prize_contributions;
CREATE POLICY "Users can contribute"
  ON prize_contributions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view contributions" ON prize_contributions;
CREATE POLICY "Users can view contributions"
  ON prize_contributions FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM contests
      WHERE contests.id = prize_contributions.contest_id
      AND (
        contests.creator_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM contest_participants
          WHERE contest_participants.contest_id = contests.id
          AND contest_participants.user_id = (select auth.uid())
        )
      )
    )
  );

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- ANALYTICS_EVENTS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own analytics" ON analytics_events;
CREATE POLICY "Users can view own analytics"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));