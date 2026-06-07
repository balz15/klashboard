/*
  # Create contest_member_exits audit table

  1. New Tables
    - `contest_member_exits`
      - `id` (uuid, primary key)
      - `contest_id` (uuid, foreign key to contests)
      - `user_id` (uuid, foreign key to auth.users)
      - `participant_id` (uuid, foreign key to contest_participants)
      - `exit_reason` (text, optional)
      - `exited_at` (timestamptz, default now)
      
  2. Security
    - Enable RLS on table
    - Users can view their own exit records
    - Contest admins can view all exits for their contest
    - System can insert exit records when users leave
    
  3. Indexes
    - Index on contest_id for admin queries
    - Index on user_id for user queries
*/

-- Create the audit table
CREATE TABLE IF NOT EXISTS contest_member_exits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES contest_participants(id) ON DELETE CASCADE,
  exit_reason text,
  exited_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contest_member_exits_contest_id ON contest_member_exits(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_member_exits_user_id ON contest_member_exits(user_id);
CREATE INDEX IF NOT EXISTS idx_contest_member_exits_participant_id ON contest_member_exits(participant_id);

-- Enable RLS
ALTER TABLE contest_member_exits ENABLE ROW LEVEL SECURITY;

-- Users can view their own exit records
CREATE POLICY "View own exit records"
  ON contest_member_exits FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Contest admins can view all exit records
CREATE POLICY "Admins view contest exits"
  ON contest_member_exits FOR SELECT TO authenticated
  USING (
    user_is_contest_admin(contest_id, auth.uid())
    OR user_is_contest_creator(contest_id, auth.uid())
  );

-- Users can insert their own exit records when leaving
CREATE POLICY "Insert own exit record"
  ON contest_member_exits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
