/*
  # Harden RLS policies — prevent cross-table infinite recursion

  Pattern to avoid: policy on table A subqueries table B whose policy subqueries A.

  Uses SECURITY DEFINER helpers from 20251228165122:
    user_is_in_contest, user_is_contest_admin, user_is_contest_creator

  Also drops orphan policies left from early migrations that stack with newer ones.
*/

-- Helper: user owns an active participant row (for submissions)
CREATE OR REPLACE FUNCTION user_owns_participant(participant_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM contest_participants
    WHERE id = participant_uuid
      AND user_id = user_uuid
      AND left_at IS NULL
  );
$$;

-- ---------------------------------------------------------------------------
-- contests (ensure no direct contest_participants subquery)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view contests" ON contests;

CREATE POLICY "Users can view contests"
  ON contests FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR creator_id = auth.uid()
    OR invite_code IS NOT NULL
    OR user_is_in_contest(id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- contest_participants — drop stale policies, keep one canonical set
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view participants of their contests" ON contest_participants;
DROP POLICY IF EXISTS "Users can join contests" ON contest_participants;
DROP POLICY IF EXISTS "Contest creators can remove participants" ON contest_participants;
DROP POLICY IF EXISTS "Users can update their participation" ON contest_participants;
DROP POLICY IF EXISTS "Contest participants can view all participants" ON contest_participants;
DROP POLICY IF EXISTS "Participants can view contest participants" ON contest_participants;
DROP POLICY IF EXISTS "Users can join contests as participants" ON contest_participants;
DROP POLICY IF EXISTS "Admins can manage participants" ON contest_participants;
DROP POLICY IF EXISTS "Admins can add participants" ON contest_participants;
DROP POLICY IF EXISTS "Admins can add participants and co-admins" ON contest_participants;
DROP POLICY IF EXISTS "Participants can update own data" ON contest_participants;
DROP POLICY IF EXISTS "Participants can update own score" ON contest_participants;
DROP POLICY IF EXISTS "Admins can update participants" ON contest_participants;
DROP POLICY IF EXISTS "Users can update own participation" ON contest_participants;
DROP POLICY IF EXISTS "Admins can remove participants" ON contest_participants;
DROP POLICY IF EXISTS "Users can remove themselves" ON contest_participants;
DROP POLICY IF EXISTS "View participants in contests" ON contest_participants;
DROP POLICY IF EXISTS "Join or admin adds members" ON contest_participants;
DROP POLICY IF EXISTS "Update participation" ON contest_participants;
DROP POLICY IF EXISTS "Leave or remove participants" ON contest_participants;
DROP POLICY IF EXISTS "Contest participants can view other participants" ON contest_participants;
DROP POLICY IF EXISTS "Participants can mark themselves as left" ON contest_participants;
DROP POLICY IF EXISTS "View participants" ON contest_participants;
DROP POLICY IF EXISTS "Join or add members" ON contest_participants;
DROP POLICY IF EXISTS "Leave or remove" ON contest_participants;

CREATE POLICY "View participants"
  ON contest_participants FOR SELECT TO authenticated
  USING (
    user_is_in_contest(contest_id, auth.uid())
    OR user_is_contest_creator(contest_id, auth.uid())
  );

CREATE POLICY "Join or add members"
  ON contest_participants FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND role = 'participant')
    OR (
      user_id = auth.uid()
      AND role = 'admin'
      AND user_is_contest_creator(contest_id, auth.uid())
    )
    OR user_is_contest_admin(contest_id, auth.uid())
    OR user_is_contest_creator(contest_id, auth.uid())
  );

CREATE POLICY "Update participation"
  ON contest_participants FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR user_is_contest_admin(contest_id, auth.uid())
    OR user_is_contest_creator(contest_id, auth.uid())
  );

CREATE POLICY "Leave or remove"
  ON contest_participants FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR user_is_contest_admin(contest_id, auth.uid())
    OR user_is_contest_creator(contest_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- submissions — avoid subquery on contest_participants from policy context
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "View submissions in joined contests" ON submissions;
DROP POLICY IF EXISTS "Create own submissions" ON submissions;
DROP POLICY IF EXISTS "Update own submissions" ON submissions;
DROP POLICY IF EXISTS "Delete own submissions" ON submissions;
DROP POLICY IF EXISTS "Users can create submissions" ON submissions;
DROP POLICY IF EXISTS "Users can view own submissions" ON submissions;
DROP POLICY IF EXISTS "Users can update own submissions" ON submissions;

CREATE POLICY "View submissions in joined contests"
  ON submissions FOR SELECT TO authenticated
  USING (user_is_in_contest(contest_id, auth.uid()));

CREATE POLICY "Create own submissions"
  ON submissions FOR INSERT TO authenticated
  WITH CHECK (user_owns_participant(participant_id, auth.uid()));

CREATE POLICY "Update own submissions"
  ON submissions FOR UPDATE TO authenticated
  USING (user_owns_participant(participant_id, auth.uid()));

CREATE POLICY "Delete own submissions"
  ON submissions FOR DELETE TO authenticated
  USING (user_owns_participant(participant_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- contest_pokes
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "contest_pokes_select_members" ON contest_pokes;
DROP POLICY IF EXISTS "contest_pokes_insert_members" ON contest_pokes;

CREATE POLICY "contest_pokes_select_members"
  ON contest_pokes FOR SELECT TO authenticated
  USING (user_is_in_contest(contest_id, auth.uid()));

CREATE POLICY "contest_pokes_insert_members"
  ON contest_pokes FOR INSERT TO authenticated
  WITH CHECK (
    from_user_id = auth.uid()
    AND user_is_in_contest(contest_id, auth.uid())
    AND user_is_in_contest(contest_id, to_user_id)
  );

-- ---------------------------------------------------------------------------
-- contest_chat_messages / reactions
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "contest_chat_messages_select_members" ON contest_chat_messages;
DROP POLICY IF EXISTS "contest_chat_messages_insert_members" ON contest_chat_messages;
DROP POLICY IF EXISTS "contest_chat_reactions_select_members" ON contest_chat_reactions;
DROP POLICY IF EXISTS "contest_chat_reactions_insert_members" ON contest_chat_reactions;

CREATE POLICY "contest_chat_messages_select_members"
  ON contest_chat_messages FOR SELECT TO authenticated
  USING (user_is_in_contest(contest_id, auth.uid()));

CREATE POLICY "contest_chat_messages_insert_members"
  ON contest_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND contest_chat_allowed(contest_id)
    AND user_is_in_contest(contest_id, auth.uid())
  );

CREATE POLICY "contest_chat_reactions_select_members"
  ON contest_chat_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_chat_messages m
      WHERE m.id = contest_chat_reactions.message_id
        AND user_is_in_contest(m.contest_id, auth.uid())
    )
  );

CREATE POLICY "contest_chat_reactions_insert_members"
  ON contest_chat_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM contest_chat_messages m
      WHERE m.id = contest_chat_reactions.message_id
        AND user_is_in_contest(m.contest_id, auth.uid())
        AND contest_chat_allowed(m.contest_id)
    )
  );

-- ---------------------------------------------------------------------------
-- user_template_submissions — use helper instead of contests subquery
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_template_submissions_insert_own" ON user_template_submissions;

CREATE POLICY "user_template_submissions_insert_own"
  ON user_template_submissions FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND user_is_contest_creator(contest_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- contest_member_exits (already uses helpers; recreate for consistency)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "View own exit records" ON contest_member_exits;
DROP POLICY IF EXISTS "Admins view contest exits" ON contest_member_exits;
DROP POLICY IF EXISTS "Insert own exit record" ON contest_member_exits;
DROP POLICY IF EXISTS "Users can view own exit records" ON contest_member_exits;
DROP POLICY IF EXISTS "Users can create own exit records" ON contest_member_exits;
DROP POLICY IF EXISTS "Admins can view all exit records for their contests" ON contest_member_exits;

CREATE POLICY "View own exit records"
  ON contest_member_exits FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view contest exits"
  ON contest_member_exits FOR SELECT TO authenticated
  USING (
    user_is_contest_admin(contest_id, auth.uid())
    OR user_is_contest_creator(contest_id, auth.uid())
  );

CREATE POLICY "Insert own exit record"
  ON contest_member_exits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
