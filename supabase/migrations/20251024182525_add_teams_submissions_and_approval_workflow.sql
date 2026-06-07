/*
  # Add Teams, Submissions, and Approval Workflow System

  1. New Tables
    - `contest_teams`
      - Team organization within contests
      - Each team has a name and captain
      - Teams belong to contests
    
    - `team_members`
      - Links participants to teams
      - Tracks which team each participant belongs to
    
    - `submission_config`
      - Defines submission requirements per contest
      - Frequency (daily, weekly, monthly, custom)
      - Evidence requirements (photo, video, none)
      - Approval workflow (auto, captain, admin)
      - Custom prompt/question for participants
    
    - `metric_submissions`
      - Individual metric submissions by participants
      - Links to metrics and participants
      - Stores values and evidence (photos/videos)
      - Approval status and approver tracking
      - Timestamps for submission and approval

  2. Role Extensions
    - Add 'captain' role to contest_participants
    - Captains can approve submissions for their team
    - Non-participating admins can oversee without competing

  3. Security
    - RLS policies for team management
    - RLS policies for submission and approval
    - Only captains can approve team submissions
    - Admins can approve any submission

  4. Features
    - Configurable submission frequency
    - Photo/video evidence support
    - Multi-level approval workflow
    - Team-based competition
*/

-- Create contest_teams table
CREATE TABLE IF NOT EXISTS contest_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  name text NOT NULL,
  captain_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(contest_id, name)
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES contest_teams(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES contest_participants(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(participant_id)
);

-- Create submission_config table
CREATE TABLE IF NOT EXISTS submission_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'custom')),
  custom_frequency_days integer,
  submission_prompt text NOT NULL DEFAULT 'Submit your progress',
  requires_evidence boolean DEFAULT false,
  evidence_type text CHECK (evidence_type IN ('photo', 'video', 'both', 'none')),
  approval_workflow text NOT NULL DEFAULT 'auto' CHECK (approval_workflow IN ('auto', 'captain', 'admin', 'captain_then_admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(contest_id)
);

-- Create metric_submissions table
CREATE TABLE IF NOT EXISTS metric_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES contest_participants(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  value numeric NOT NULL,
  evidence_url text,
  evidence_type text CHECK (evidence_type IN ('photo', 'video', 'none')),
  submission_notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  submitted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Update contest_participants role constraint to include captain
ALTER TABLE contest_participants DROP CONSTRAINT IF EXISTS contest_participants_role_check;
ALTER TABLE contest_participants 
ADD CONSTRAINT contest_participants_role_check 
CHECK (role IN ('owner', 'co_admin', 'captain', 'participant'));

-- Add is_participating flag for non-participating admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contest_participants' AND column_name = 'is_participating'
  ) THEN
    ALTER TABLE contest_participants ADD COLUMN is_participating boolean DEFAULT true;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_participant_id ON team_members(participant_id);
CREATE INDEX IF NOT EXISTS idx_metric_submissions_contest_id ON metric_submissions(contest_id);
CREATE INDEX IF NOT EXISTS idx_metric_submissions_participant_id ON metric_submissions(participant_id);
CREATE INDEX IF NOT EXISTS idx_metric_submissions_status ON metric_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contest_teams_contest_id ON contest_teams(contest_id);

-- RLS Policies for contest_teams

ALTER TABLE contest_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contest participants can view teams"
  ON contest_teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.contest_id = contest_teams.contest_id
      AND contest_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage teams"
  ON contest_teams FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.contest_id = contest_teams.contest_id
      AND contest_participants.user_id = auth.uid()
      AND contest_participants.role IN ('owner', 'co_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.contest_id = contest_teams.contest_id
      AND contest_participants.user_id = auth.uid()
      AND contest_participants.role IN ('owner', 'co_admin')
    )
  );

-- RLS Policies for team_members

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contest participants can view team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_teams ct
      JOIN contest_participants cp ON cp.contest_id = ct.contest_id
      WHERE ct.id = team_members.team_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and captains can manage team members"
  ON team_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_teams ct
      JOIN contest_participants cp ON cp.contest_id = ct.contest_id
      WHERE ct.id = team_members.team_id
      AND cp.user_id = auth.uid()
      AND (cp.role IN ('owner', 'co_admin') OR ct.captain_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contest_teams ct
      JOIN contest_participants cp ON cp.contest_id = ct.contest_id
      WHERE ct.id = team_members.team_id
      AND cp.user_id = auth.uid()
      AND (cp.role IN ('owner', 'co_admin') OR ct.captain_id = auth.uid())
    )
  );

-- RLS Policies for submission_config

ALTER TABLE submission_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contest participants can view submission config"
  ON submission_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.contest_id = submission_config.contest_id
      AND contest_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage submission config"
  ON submission_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.contest_id = submission_config.contest_id
      AND contest_participants.user_id = auth.uid()
      AND contest_participants.role IN ('owner', 'co_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.contest_id = submission_config.contest_id
      AND contest_participants.user_id = auth.uid()
      AND contest_participants.role IN ('owner', 'co_admin')
    )
  );

-- RLS Policies for metric_submissions

ALTER TABLE metric_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view submissions in their contest"
  ON metric_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.contest_id = metric_submissions.contest_id
      AND contest_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can create own submissions"
  ON metric_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.contest_id = metric_submissions.contest_id
      AND contest_participants.user_id = auth.uid()
      AND contest_participants.id = metric_submissions.participant_id
    )
  );

CREATE POLICY "Participants can update own pending submissions"
  ON metric_submissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.id = metric_submissions.participant_id
      AND contest_participants.user_id = auth.uid()
    )
    AND status = 'pending'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.id = metric_submissions.participant_id
      AND contest_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Captains and admins can approve submissions"
  ON metric_submissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = metric_submissions.contest_id
      AND cp.user_id = auth.uid()
      AND (
        cp.role IN ('owner', 'co_admin')
        OR (
          cp.role = 'captain'
          AND EXISTS (
            SELECT 1 FROM team_members tm
            JOIN contest_teams ct ON ct.id = tm.team_id
            WHERE tm.participant_id = metric_submissions.participant_id
            AND ct.captain_id = auth.uid()
          )
        )
      )
    )
  );
