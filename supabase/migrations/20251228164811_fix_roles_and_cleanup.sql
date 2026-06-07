/*
  # Fix Roles and Security Cleanup

  1. Update role constraints and data
  2. Drop unused tables and indexes  
  3. Fix submissions table structure
  4. Consolidate RLS policies
*/

-- Step 1: Drop old constraint, update data, add new constraint
ALTER TABLE contest_participants DROP CONSTRAINT IF EXISTS contest_participants_role_check;

UPDATE contest_participants 
SET role = 'admin' 
WHERE role IN ('owner', 'co_admin', 'captain');

ALTER TABLE contest_participants 
ADD CONSTRAINT contest_participants_role_check 
CHECK (role = ANY (ARRAY['admin'::text, 'participant'::text]));

-- Step 2: Drop obsolete columns
ALTER TABLE contest_participants DROP COLUMN IF EXISTS assigned_by CASCADE;
ALTER TABLE contest_participants DROP COLUMN IF EXISTS is_participating;
ALTER TABLE contest_participants DROP COLUMN IF EXISTS exit_reason;

-- Step 3: Drop unused tables
DROP TABLE IF EXISTS metric_submissions CASCADE;
DROP TABLE IF EXISTS contest_teams CASCADE;
DROP TABLE IF EXISTS analytics_events CASCADE;
DROP TABLE IF EXISTS contest_member_exits CASCADE;
DROP TABLE IF EXISTS prize_contributions CASCADE;
DROP TABLE IF EXISTS template_purchases CASCADE;
DROP TABLE IF EXISTS templates CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS submission_config CASCADE;

-- Step 4: Recreate submissions table with correct structure
DROP TABLE IF EXISTS submissions CASCADE;

CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES contest_participants(id) ON DELETE CASCADE,
  submission_date date NOT NULL DEFAULT CURRENT_DATE,
  metric_values jsonb NOT NULL DEFAULT '{}',
  notes text,
  streak_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(contest_id, participant_id, submission_date)
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for submissions
CREATE POLICY "View submissions in joined contests"
  ON submissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = submissions.contest_id
      AND cp.user_id = auth.uid()
      AND cp.left_at IS NULL
    )
  );

CREATE POLICY "Create own submissions"
  ON submissions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.id = submissions.participant_id
      AND cp.user_id = auth.uid()
      AND cp.left_at IS NULL
    )
  );

CREATE POLICY "Update own submissions"
  ON submissions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.id = submissions.participant_id
      AND cp.user_id = auth.uid()
      AND cp.left_at IS NULL
    )
  );

CREATE POLICY "Delete own submissions"
  ON submissions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.id = submissions.participant_id
      AND cp.user_id = auth.uid()
      AND cp.left_at IS NULL
    )
  );

-- Step 6: Consolidate contest_participants policies
DROP POLICY IF EXISTS "Admins can add participants and co-admins" ON contest_participants;
DROP POLICY IF EXISTS "Users can join contests as participants" ON contest_participants;
DROP POLICY IF EXISTS "Admins can update participants" ON contest_participants;
DROP POLICY IF EXISTS "Users can update their participation" ON contest_participants;
DROP POLICY IF EXISTS "Admins can remove participants" ON contest_participants;
DROP POLICY IF EXISTS "Users can remove themselves" ON contest_participants;
DROP POLICY IF EXISTS "Contest participants can view other participants" ON contest_participants;

CREATE POLICY "View participants in contests"
  ON contest_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = contest_participants.contest_id
      AND cp.user_id = auth.uid()
      AND cp.left_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM contests c
      WHERE c.id = contest_participants.contest_id
      AND c.creator_id = auth.uid()
    )
  );

CREATE POLICY "Join or admin adds members"
  ON contest_participants FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND role = 'participant')
    OR EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = contest_participants.contest_id
      AND cp.user_id = auth.uid()
      AND cp.role = 'admin'
      AND cp.left_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM contests c
      WHERE c.id = contest_participants.contest_id
      AND c.creator_id = auth.uid()
    )
  );

CREATE POLICY "Update participation"
  ON contest_participants FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = contest_participants.contest_id
      AND cp.user_id = auth.uid()
      AND cp.role = 'admin'
      AND cp.left_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM contests c
      WHERE c.id = contest_participants.contest_id
      AND c.creator_id = auth.uid()
    )
  );

CREATE POLICY "Leave or remove participants"
  ON contest_participants FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = contest_participants.contest_id
      AND cp.user_id = auth.uid()
      AND cp.role = 'admin'
      AND cp.left_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM contests c
      WHERE c.id = contest_participants.contest_id
      AND c.creator_id = auth.uid()
    )
  );

-- Step 7: Drop unused indexes
DROP INDEX IF EXISTS idx_contests_status;
DROP INDEX IF EXISTS idx_contest_participants_contest;
DROP INDEX IF EXISTS idx_contest_participants_user;
DROP INDEX IF EXISTS idx_contest_participants_assigned_by;
DROP INDEX IF EXISTS idx_submissions_contest;
DROP INDEX IF EXISTS idx_submissions_user;
DROP INDEX IF EXISTS idx_submissions_status;
DROP INDEX IF EXISTS idx_submissions_reviewed_by;

-- Step 8: Create optimized indexes
CREATE INDEX idx_submissions_participant_date 
  ON submissions(participant_id, submission_date DESC);

CREATE INDEX idx_submissions_contest_date 
  ON submissions(contest_id, submission_date DESC);

CREATE INDEX idx_contest_participants_user_contest 
  ON contest_participants(user_id, contest_id) 
  WHERE left_at IS NULL;

CREATE INDEX idx_contest_participants_contest_active 
  ON contest_participants(contest_id, role) 
  WHERE left_at IS NULL;

CREATE INDEX idx_contests_active 
  ON contests(status, end_date) 
  WHERE status = 'active';
