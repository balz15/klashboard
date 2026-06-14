/*
  User template submissions, nudge messages, group chat, app admin flag
*/

-- App maker / template approver (set your user id or use email check in app)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_app_admin boolean NOT NULL DEFAULT false;

-- Extend pokes with optional custom message
ALTER TABLE contest_pokes ADD COLUMN IF NOT EXISTS message text;

-- User-submitted templates awaiting approval
CREATE TABLE IF NOT EXISTS user_template_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  default_metrics jsonb NOT NULL DEFAULT '[]',
  suggested_duration_days integer DEFAULT 30,
  icon text DEFAULT 'target',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  published_template_id uuid REFERENCES challenge_templates(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_template_submissions_status_idx
  ON user_template_submissions (status, created_at DESC);

ALTER TABLE user_template_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_template_submissions_select_own_or_admin"
  ON user_template_submissions FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_app_admin = true)
  );

CREATE POLICY "user_template_submissions_insert_own"
  ON user_template_submissions FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM contests c
      WHERE c.id = contest_id AND c.creator_id = auth.uid()
    )
  );

CREATE POLICY "user_template_submissions_update_admin"
  ON user_template_submissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_app_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_app_admin = true));

-- Mark user-published templates in challenge_templates
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id);
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS source_contest_id uuid REFERENCES contests(id);

-- Group chat (140 chars, 7-day grace after contest end)
CREATE TABLE IF NOT EXISTS contest_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 140),
  reply_to_id uuid REFERENCES contest_chat_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contest_chat_messages_contest_idx
  ON contest_chat_messages (contest_id, created_at ASC);

CREATE TABLE IF NOT EXISTS contest_chat_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES contest_chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) <= 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS contest_chat_reactions_message_idx
  ON contest_chat_reactions (message_id);

ALTER TABLE contest_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_chat_reactions ENABLE ROW LEVEL SECURITY;

-- Chat: members only, within contest window + 7 days after end
CREATE OR REPLACE FUNCTION contest_chat_allowed(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM contests c
    WHERE c.id = cid
      AND (
        (c.status <> 'completed' AND current_date <= (c.end_date::date + interval '7 days')::date)
        OR (c.status = 'completed' AND current_date <= (COALESCE(c.ended_at, c.end_date)::date + interval '7 days')::date)
      )
  );
$$;

CREATE POLICY "contest_chat_messages_select_members"
  ON contest_chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = contest_chat_messages.contest_id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

CREATE POLICY "contest_chat_messages_insert_members"
  ON contest_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND contest_chat_allowed(contest_id)
    AND EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = contest_chat_messages.contest_id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

CREATE POLICY "contest_chat_reactions_select_members"
  ON contest_chat_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_chat_messages m
      JOIN contest_participants cp ON cp.contest_id = m.contest_id
      WHERE m.id = contest_chat_reactions.message_id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

CREATE POLICY "contest_chat_reactions_insert_members"
  ON contest_chat_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM contest_chat_messages m
      JOIN contest_participants cp ON cp.contest_id = m.contest_id
      WHERE m.id = contest_chat_reactions.message_id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
        AND contest_chat_allowed(m.contest_id)
    )
  );

CREATE POLICY "contest_chat_reactions_delete_own"
  ON contest_chat_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Admins can insert user_created templates
CREATE POLICY "challenge_templates_insert_admin"
  ON challenge_templates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_app_admin = true)
  );

-- Enable Realtime in Supabase Dashboard → Database → Publications → supabase_realtime
-- for tables: contest_chat_messages, contest_pokes
