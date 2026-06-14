-- ========== 20251024170000_initial_core_schema.sql ==========

/*
  # Initial core schema (fresh Supabase projects)

  The later migrations in this repo were written against an existing database.
  This file creates the base tables and legacy stubs those migrations expect.
  Run this first (it is included at the top of combined-migrations.sql).
*/

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Contests / challenges
CREATE TABLE IF NOT EXISTS contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  start_date date NOT NULL,
  end_date date NOT NULL,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'pending_approval')),
  metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  scoring_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  invite_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Contest membership
CREATE TABLE IF NOT EXISTS contest_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'participant' CHECK (role IN ('admin', 'participant', 'verifier')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contest_id, user_id)
);

ALTER TABLE contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_participants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_contest_participants_contest_id ON contest_participants(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_participants_user_id ON contest_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_contests_creator_id ON contests(creator_id);

CREATE POLICY "Users can create contests"
  ON contests FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Users can view contests"
  ON contests FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    OR creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = contests.id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Contest creators can update contests"
  ON contests FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Contest creators can delete contests"
  ON contests FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- Legacy tables referenced by mid-chain migrations (dropped or replaced later)
CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid REFERENCES contests(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'contest_update',
  title text,
  message text,
  link text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS template_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES templates(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prize_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid REFERENCES contests(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid REFERENCES contests(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE prize_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Auto-create profile row when a user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Table-level grants (required for authenticated API access)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;



-- ========== 20251024174502_fix_contest_participants_policies.sql ==========

/*
  # Fix Contest Participants RLS Policies

  1. Changes
    - Remove recursive policies that cause infinite loops
    - Create simple, direct policies without self-referencing queries
    - Allow users to view participants of contests they created or joined
    - Allow users to join contests directly
    - Allow admins to manage participants

  2. Security
    - Users can view participants of any contest they're involved with
    - Users can join contests
    - Only the contest creator can remove participants
*/

-- Create simple SELECT policy
CREATE POLICY "Users can view participants of their contests"
  ON contest_participants FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    contest_id IN (
      SELECT id FROM contests WHERE creator_id = auth.uid()
    )
  );

-- Allow users to insert themselves as participants
CREATE POLICY "Users can join contests"
  ON contest_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow contest creators to delete participants
CREATE POLICY "Contest creators can remove participants"
  ON contest_participants FOR DELETE
  TO authenticated
  USING (
    contest_id IN (
      SELECT id FROM contests WHERE creator_id = auth.uid()
    )
  );

-- Allow users to update their own participation
CREATE POLICY "Users can update their participation"
  ON contest_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());



-- ========== 20251024180239_update_roles_to_owner_coadmin.sql ==========

/*
  # Update role system to owner/co-admin hierarchy

  1. Changes
    - Replace 'admin' role with 'owner' for contest creators
    - Add 'co_admin' role for secondary administrators  
    - Remove 'verifier' role (not currently used)
    - Add assigned_by tracking column
    - Ensure only one owner per contest
    - Update RLS policies for proper permission hierarchy

  2. Permission Hierarchy
    - Owner (creator): Full control, cannot be removed or have role changed
    - Co-admin: Can manage participants and settings, but cannot modify owner
    - Participant: Can submit metrics and view contest only

  3. Security
    - Only owner can assign co-admin roles
    - Co-admins cannot modify owner's role or permissions
    - Co-admins cannot remove the owner
*/

-- Add assigned_by column to track who gave someone their role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contest_participants' AND column_name = 'assigned_by'
  ) THEN
    ALTER TABLE contest_participants ADD COLUMN assigned_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Drop the old constraint
ALTER TABLE contest_participants DROP CONSTRAINT IF EXISTS contest_participants_role_check;

-- Update existing roles: admin -> owner, verifier -> participant
UPDATE contest_participants cp
SET role = 'owner'
WHERE role = 'admin'
AND user_id = (SELECT creator_id FROM contests WHERE id = cp.contest_id);

UPDATE contest_participants
SET role = 'participant'
WHERE role = 'verifier';

-- Add new check constraint with owner, co_admin, participant
ALTER TABLE contest_participants 
ADD CONSTRAINT contest_participants_role_check 
CHECK (role IN ('owner', 'co_admin', 'participant'));

-- Ensure only one owner per contest
DROP INDEX IF EXISTS contest_participants_one_owner_per_contest;
CREATE UNIQUE INDEX contest_participants_one_owner_per_contest 
ON contest_participants (contest_id) 
WHERE role = 'owner';

-- Helper function to get contest owner
CREATE OR REPLACE FUNCTION get_contest_owner(contest_uuid uuid)
RETURNS uuid AS $$
  SELECT user_id FROM contest_participants 
  WHERE contest_id = contest_uuid AND role = 'owner'
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Helper function to check if user is admin (owner or co-admin)
CREATE OR REPLACE FUNCTION is_contest_admin(contest_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM contest_participants 
    WHERE contest_id = contest_uuid 
    AND user_id = user_uuid 
    AND role IN ('owner', 'co_admin')
  );
$$ LANGUAGE SQL STABLE;

-- Drop all existing policies
DROP POLICY IF EXISTS "Contest participants can view all participants" ON contest_participants;
DROP POLICY IF EXISTS "Participants can view contest participants" ON contest_participants;
DROP POLICY IF EXISTS "Users can join contests" ON contest_participants;
DROP POLICY IF EXISTS "Users can join contests as participants" ON contest_participants;
DROP POLICY IF EXISTS "Admins can manage participants" ON contest_participants;
DROP POLICY IF EXISTS "Admins can add participants" ON contest_participants;
DROP POLICY IF EXISTS "Admins can update participants" ON contest_participants;
DROP POLICY IF EXISTS "Users can update own participation" ON contest_participants;
DROP POLICY IF EXISTS "Participants can update own score" ON contest_participants;
DROP POLICY IF EXISTS "Admins can remove participants" ON contest_participants;

-- SELECT: Contest participants can view all participants in their contest
CREATE POLICY "Contest participants can view all participants"
  ON contest_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = contest_participants.contest_id
      AND cp.user_id = auth.uid()
    )
  );

-- INSERT: Users can join as participants
CREATE POLICY "Users can join contests as participants"
  ON contest_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'participant'
  );

-- INSERT: Admins can add participants and assign co-admins
CREATE POLICY "Admins can add participants and co-admins"
  ON contest_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    is_contest_admin(contest_id, auth.uid())
    AND user_id != auth.uid()  -- Can't add yourself
    AND (
      role = 'participant'  -- Any admin can add participants
      OR (role = 'co_admin' AND get_contest_owner(contest_id) = auth.uid())  -- Only owner can add co-admins
    )
  );

-- UPDATE: Participants can update their own score
CREATE POLICY "Participants can update own data"
  ON contest_participants FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
  )
  WITH CHECK (
    auth.uid() = user_id
    AND role = (SELECT role FROM contest_participants WHERE id = contest_participants.id)  -- Cannot change own role
  );

-- UPDATE: Admins can update other participants (but not owner or themselves)
CREATE POLICY "Admins can update participants"
  ON contest_participants FOR UPDATE
  TO authenticated
  USING (
    user_id != auth.uid()  -- Can't update self via this policy
    AND is_contest_admin(contest_id, auth.uid())
    AND role != 'owner'  -- Cannot modify owner
  )
  WITH CHECK (
    user_id != auth.uid()
    AND is_contest_admin(contest_id, auth.uid())
    AND role != 'owner'  -- Cannot promote someone to owner
    AND (
      get_contest_owner(contest_id) = auth.uid()  -- Owner can update anyone
      OR role = 'participant'  -- Co-admins can only update participants
    )
  );

-- DELETE: Admins can remove participants (but not owner)
CREATE POLICY "Admins can remove participants"
  ON contest_participants FOR DELETE
  TO authenticated
  USING (
    is_contest_admin(contest_id, auth.uid())
    AND role != 'owner'  -- Cannot remove owner
    AND user_id != auth.uid()  -- Cannot remove self
    AND (
      get_contest_owner(contest_id) = auth.uid()  -- Owner can remove co-admins and participants
      OR role = 'participant'  -- Co-admins can only remove regular participants
    )
  );



-- ========== 20251024182525_add_teams_submissions_and_approval_workflow.sql ==========

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



-- ========== 20251028160357_add_contest_lifecycle_management.sql ==========

/*
  # Add Contest Lifecycle Management Features

  ## Overview
  This migration adds features for contest lifecycle management including:
  - Ability for members to leave contests
  - Admin controls to end contests
  - Admin controls to close contests for new joiners
  - Auto-expiry configuration
  - Audit trail for member exits

  ## Changes

  1. New Columns in `contests` table
    - `is_closed_for_joining` (boolean) - Prevents new members from joining
    - `ended_at` (timestamptz) - Timestamp when contest was manually ended
    - `auto_delete_at` (timestamptz) - Scheduled auto-deletion date

  2. New Columns in `contest_participants` table
    - `left_at` (timestamptz) - When participant left the contest
    - `exit_reason` (text) - Optional reason for leaving

  3. New Table `contest_member_exits`
    - Audit trail for when members leave contests
    - Includes user_id, contest_id, reason, and timestamp

  4. New notification type
    - Add 'contest_ended' to notification types

  5. Security
    - Update RLS policies to respect is_closed_for_joining
    - Allow participants to mark themselves as left
    - Only admins can end contests or close for joining

  ## Important Notes
  - Uses soft delete approach (participants remain in table but marked as left)
  - Auto-delete happens 30 days after end_date by default
  - Notifications sent to all active participants when contest ends
*/

-- Add new columns to contests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contests' AND column_name = 'is_closed_for_joining'
  ) THEN
    ALTER TABLE contests ADD COLUMN is_closed_for_joining boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contests' AND column_name = 'ended_at'
  ) THEN
    ALTER TABLE contests ADD COLUMN ended_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contests' AND column_name = 'auto_delete_at'
  ) THEN
    ALTER TABLE contests ADD COLUMN auto_delete_at timestamptz;
  END IF;
END $$;

-- Add new columns to contest_participants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contest_participants' AND column_name = 'left_at'
  ) THEN
    ALTER TABLE contest_participants ADD COLUMN left_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contest_participants' AND column_name = 'exit_reason'
  ) THEN
    ALTER TABLE contest_participants ADD COLUMN exit_reason text;
  END IF;
END $$;

-- Create contest_member_exits audit table
CREATE TABLE IF NOT EXISTS contest_member_exits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES contest_participants(id) ON DELETE SET NULL,
  exit_reason text,
  exited_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_contest_member_exits_contest_id ON contest_member_exits(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_member_exits_user_id ON contest_member_exits(user_id);

-- Update notifications type constraint to include contest_ended
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('milestone', 'verification', 'rank_change', 'contest_update', 'contest_ended'));

-- RLS for contest_member_exits
ALTER TABLE contest_member_exits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exit records"
  ON contest_member_exits FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own exit records"
  ON contest_member_exits FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all exit records for their contests"
  ON contest_member_exits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.contest_id = contest_member_exits.contest_id
      AND contest_participants.user_id = auth.uid()
      AND contest_participants.role IN ('owner', 'co_admin')
    )
  );

-- Update contest_participants policies to allow leaving
CREATE POLICY "Participants can mark themselves as left"
  ON contest_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to automatically set auto_delete_at when contest ends
CREATE OR REPLACE FUNCTION set_auto_delete_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    IF NEW.auto_delete_at IS NULL THEN
      NEW.auto_delete_at := NEW.end_date + INTERVAL '30 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto_delete_at
DROP TRIGGER IF EXISTS trigger_set_auto_delete_at ON contests;
CREATE TRIGGER trigger_set_auto_delete_at
  BEFORE UPDATE ON contests
  FOR EACH ROW
  EXECUTE FUNCTION set_auto_delete_at();

-- Function to send notifications when contest ends
CREATE OR REPLACE FUNCTION notify_contest_ended()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    SELECT 
      cp.user_id,
      'contest_ended',
      'Contest Ended: ' || NEW.name,
      'The contest "' || NEW.name || '" has ended. Check the final results!',
      '/contest/' || NEW.id
    FROM contest_participants cp
    WHERE cp.contest_id = NEW.id
    AND cp.left_at IS NULL
    AND cp.user_id != NEW.creator_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for contest ended notifications
DROP TRIGGER IF EXISTS trigger_notify_contest_ended ON contests;
CREATE TRIGGER trigger_notify_contest_ended
  AFTER UPDATE ON contests
  FOR EACH ROW
  EXECUTE FUNCTION notify_contest_ended();



-- ========== 20251028160941_fix_contest_participants_policy_recursion.sql ==========

/*
  # Fix Infinite Recursion in Contest Participants Policies

  ## Problem
  The "Participants can mark themselves as left" policy is causing infinite recursion
  when trying to update contest_participants because it checks contest_participants
  in its own policy.

  ## Solution
  Remove the conflicting policy and rely on the existing participant update policies
  that already handle self-updates correctly.

  ## Changes
  - Drop the problematic "Participants can mark themselves as left" policy
  - The existing policies already allow participants to update their own records
*/

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Participants can mark themselves as left" ON contest_participants;

-- Verify existing update policies handle leaving correctly
-- The existing "Participants can update own pending submissions" and similar
-- policies already allow users to update their own participant records



-- ========== 20251028161137_fix_participant_update_policy_recursion.sql ==========

/*
  # Fix Recursive Policy in Contest Participants Update

  ## Problem
  The "Participants can update own data" policy has a WITH CHECK clause that
  queries contest_participants table recursively:
  ```
  role = (SELECT role FROM contest_participants WHERE id = id)
  ```
  This causes infinite recursion when updating.

  ## Solution
  Drop the problematic policy and rely on the cleaner "Users can update their 
  participation" policy which already allows users to update their own records
  without recursion.

  ## Changes
  - Drop "Participants can update own data" policy (causes recursion)
  - Keep "Users can update their participation" policy (clean, no recursion)
*/

-- Drop the recursive policy
DROP POLICY IF EXISTS "Participants can update own data" ON contest_participants;

-- The "Users can update their participation" policy is sufficient:
-- USING (user_id = auth.uid())
-- WITH CHECK (user_id = auth.uid())
-- This allows users to update their own participation records including left_at and exit_reason



-- ========== 20251028161446_fix_contest_participants_select_recursion.sql ==========

/*
  # Fix Infinite Recursion in Contest Participants SELECT Policy

  ## Problem
  The "Contest participants can view all participants" policy has a recursive check:
  ```
  EXISTS (SELECT 1 FROM contest_participants cp WHERE cp.contest_id = contest_participants.contest_id AND cp.user_id = auth.uid())
  ```
  This queries contest_participants from within a policy on contest_participants, causing infinite recursion.

  ## Solution
  Replace the recursive SELECT policy with a simpler one that doesn't query the same table.
  Since we already have "View contest participants" with USING (true), we can rely on that
  and drop the recursive one.

  ## Changes
  - Drop the recursive "Contest participants can view all participants" policy
  - Keep "View contest participants" policy which allows all authenticated users to view
*/

-- Drop the recursive SELECT policy
DROP POLICY IF EXISTS "Contest participants can view all participants" ON contest_participants;

-- The "View contest participants" policy remains:
-- USING (true) - allows all authenticated users to view all participants
-- This is sufficient for the application's needs



-- ========== 20251028164217_add_missing_foreign_key_indexes.sql ==========

/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Creates indexes for all unindexed foreign key columns
    - Improves query performance for JOIN operations
    - Reduces query execution time for lookups

  2. Indexed Tables
    - analytics_events (contest_id, user_id)
    - contest_member_exits (participant_id)
    - contest_participants (assigned_by)
    - contest_teams (captain_id)
    - metric_submissions (approved_by)
    - prize_contributions (contest_id, user_id)
    - submissions (reviewed_by)
    - template_purchases (buyer_id, template_id)
    - templates (creator_id)
*/

-- analytics_events indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_contest_id 
  ON analytics_events(contest_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id 
  ON analytics_events(user_id);

-- contest_member_exits indexes
CREATE INDEX IF NOT EXISTS idx_contest_member_exits_participant_id_fk 
  ON contest_member_exits(participant_id);

-- contest_participants indexes
CREATE INDEX IF NOT EXISTS idx_contest_participants_assigned_by 
  ON contest_participants(assigned_by);

-- contest_teams indexes
CREATE INDEX IF NOT EXISTS idx_contest_teams_captain_id 
  ON contest_teams(captain_id);

-- metric_submissions indexes
CREATE INDEX IF NOT EXISTS idx_metric_submissions_approved_by 
  ON metric_submissions(approved_by);

-- prize_contributions indexes
CREATE INDEX IF NOT EXISTS idx_prize_contributions_contest_id_fk 
  ON prize_contributions(contest_id);

CREATE INDEX IF NOT EXISTS idx_prize_contributions_user_id_fk 
  ON prize_contributions(user_id);

-- submissions indexes
CREATE INDEX IF NOT EXISTS idx_submissions_reviewed_by 
  ON submissions(reviewed_by);

-- template_purchases indexes
CREATE INDEX IF NOT EXISTS idx_template_purchases_buyer_id 
  ON template_purchases(buyer_id);

CREATE INDEX IF NOT EXISTS idx_template_purchases_template_id 
  ON template_purchases(template_id);

-- templates indexes
CREATE INDEX IF NOT EXISTS idx_templates_creator_id 
  ON templates(creator_id);


-- ========== 20251028164242_optimize_rls_policies_part_1_profiles_contests.sql ==========

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


-- ========== 20251028164301_optimize_rls_policies_part_2_participants.sql ==========

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


-- ========== 20251028164323_optimize_rls_policies_part_3_submissions_templates.sql ==========

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


-- ========== 20251028164352_optimize_rls_policies_part_4_teams_and_workflow.sql ==========

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


-- ========== 20251028164500_fix_function_search_paths_v3.sql ==========

/*
  # Fix Function Search Paths - Version 3

  1. Security Improvements
    - Replace functions using CREATE OR REPLACE to preserve triggers
    - Set SECURITY DEFINER on all functions
    - Fix search_path to prevent SQL injection

  2. Updated Functions
    - handle_new_user (trigger function)
    - is_contest_admin (returns boolean)
    - get_contest_owner (returns uuid)
    - notify_contest_ended (trigger function)
    - set_auto_delete_at (trigger function)
*/

-- Replace handle_new_user function with proper search_path
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Replace is_contest_admin function with proper search_path
-- Need to drop first since we're changing from plpgsql to sql
DROP FUNCTION IF EXISTS is_contest_admin(uuid, uuid) CASCADE;

CREATE FUNCTION is_contest_admin(contest_uuid uuid, user_uuid uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contest_participants 
    WHERE contest_id = contest_uuid 
    AND user_id = user_uuid 
    AND role IN ('owner', 'co_admin')
  );
$$;

-- Replace get_contest_owner function with proper search_path
DROP FUNCTION IF EXISTS get_contest_owner(uuid) CASCADE;

CREATE FUNCTION get_contest_owner(contest_uuid uuid)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT user_id FROM public.contest_participants 
  WHERE contest_id = contest_uuid AND role = 'owner'
  LIMIT 1;
$$;

-- Replace notify_contest_ended function with proper search_path
CREATE OR REPLACE FUNCTION notify_contest_ended()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    SELECT 
      cp.user_id,
      'contest_ended',
      'Contest Ended: ' || NEW.name,
      'The contest "' || NEW.name || '" has ended. Check the final results!',
      '/contest/' || NEW.id
    FROM public.contest_participants cp
    WHERE cp.contest_id = NEW.id
    AND cp.left_at IS NULL
    AND cp.user_id != NEW.creator_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Replace set_auto_delete_at function with proper search_path
CREATE OR REPLACE FUNCTION set_auto_delete_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    IF NEW.auto_delete_at IS NULL THEN
      NEW.auto_delete_at := NEW.end_date + INTERVAL '30 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


-- ========== 20251029145721_create_contest_evidence_storage.sql ==========

/*
  # Create Storage Bucket for Contest Evidence
  
  1. Storage Bucket
    - Create `contest-evidence` bucket for storing submission photos/videos
    - Enable public access for viewing evidence
  
  Note: Storage policies should be configured via Supabase Dashboard:
    - Allow authenticated users to upload to their own folders
    - Allow users to view evidence in contests they participate in
*/

-- Create the storage bucket for contest evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('contest-evidence', 'contest-evidence', true)
ON CONFLICT (id) DO NOTHING;


-- ========== 20251228163344_refactor_to_challenges_app.sql ==========

/*
  # Refactor to Challenges App

  1. New Tables
    - `challenge_templates`
      - `id` (uuid, primary key)
      - `name` (text) - Template name (e.g., "10K Steps Daily")
      - `description` (text) - Template description
      - `category` (text) - fitness, health, productivity, mindfulness, custom
      - `default_metrics` (jsonb) - Array of default metrics with names and units
      - `suggested_duration_days` (integer) - Suggested challenge duration
      - `icon` (text) - Icon identifier
      - `created_at` (timestamptz)
  
  2. Modified Tables
    - `submissions` - Remove approval workflow columns
      - Drop `approved_by`, `rejected_by`, `rejection_reason`
      - Drop `approved_at`, `rejected_at`
      - Add `streak_count` (integer) - Current streak for this submission
    
  3. Removed Tables
    - Drop `teams` table (no longer needed)
    - Drop `team_members` table (no longer needed)
    - Drop `contest_evidence` table (no longer needed)

  4. Security
    - Enable RLS on `challenge_templates` table
    - Add policies for public read access to templates
    - Update existing policies to reflect simplified model

  5. Important Notes
    - All contests are now private by default (no discovery)
    - Simplified to creator + admin roles (WhatsApp style)
    - Focus on daily metric tracking and streaks
    - Removed approval workflow entirely
*/

-- Create challenge templates table
CREATE TABLE IF NOT EXISTS challenge_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  default_metrics jsonb NOT NULL DEFAULT '[]',
  suggested_duration_days integer DEFAULT 30,
  icon text DEFAULT 'target',
  created_at timestamptz DEFAULT now()
);

-- Add streak tracking to submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'streak_count'
  ) THEN
    ALTER TABLE submissions ADD COLUMN streak_count integer DEFAULT 0;
  END IF;
END $$;

-- Remove approval workflow columns from submissions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE submissions DROP COLUMN IF EXISTS approved_by;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'rejected_by'
  ) THEN
    ALTER TABLE submissions DROP COLUMN IF EXISTS rejected_by;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE submissions DROP COLUMN IF EXISTS rejection_reason;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE submissions DROP COLUMN IF EXISTS approved_at;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'rejected_at'
  ) THEN
    ALTER TABLE submissions DROP COLUMN IF EXISTS rejected_at;
  END IF;
END $$;

-- Drop teams tables (no longer needed)
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Drop evidence table (no longer needed)
DROP TABLE IF EXISTS contest_evidence CASCADE;

-- Enable RLS on challenge_templates
ALTER TABLE challenge_templates ENABLE ROW LEVEL SECURITY;

-- Public read access to templates
CREATE POLICY "Anyone can view challenge templates"
  ON challenge_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert preset challenge templates
INSERT INTO challenge_templates (name, description, category, default_metrics, suggested_duration_days, icon)
VALUES 
  (
    '10K Steps Daily',
    'Walk 10,000 steps every day to improve cardiovascular health and build a consistent movement habit',
    'fitness',
    '[{"name": "Steps", "unit": "steps"}]'::jsonb,
    30,
    'footprints'
  ),
  (
    '50 Pushups Daily',
    'Build upper body strength with 50 pushups each day (can be broken into sets)',
    'fitness',
    '[{"name": "Pushups", "unit": "reps"}]'::jsonb,
    30,
    'dumbbell'
  ),
  (
    '10 Minutes Meditation',
    'Practice mindfulness with 10 minutes of meditation daily to reduce stress and improve focus',
    'mindfulness',
    '[{"name": "Minutes", "unit": "min"}]'::jsonb,
    21,
    'brain'
  ),
  (
    '8 Hours Sleep',
    'Prioritize rest and recovery with 8 hours of quality sleep each night',
    'health',
    '[{"name": "Hours", "unit": "hrs"}]'::jsonb,
    30,
    'moon'
  ),
  (
    '2L Water Daily',
    'Stay hydrated by drinking 2 liters of water throughout the day',
    'health',
    '[{"name": "Water", "unit": "L"}]'::jsonb,
    30,
    'droplet'
  ),
  (
    '30 Min Reading',
    'Develop a reading habit with 30 minutes of focused reading each day',
    'productivity',
    '[{"name": "Minutes", "unit": "min"}]'::jsonb,
    30,
    'book-open'
  ),
  (
    'No Social Media',
    'Track days without using social media to improve focus and mental clarity',
    'productivity',
    '[{"name": "Hours Avoided", "unit": "hrs"}]'::jsonb,
    14,
    'smartphone'
  ),
  (
    '5K Run',
    'Run 5 kilometers to build endurance and cardiovascular fitness',
    'fitness',
    '[{"name": "Distance", "unit": "km"}, {"name": "Time", "unit": "min"}]'::jsonb,
    60,
    'activity'
  ),
  (
    'Gratitude Journal',
    'Write down 3 things you''re grateful for each day to cultivate positivity',
    'mindfulness',
    '[{"name": "Entries", "unit": "count"}]'::jsonb,
    21,
    'heart'
  ),
  (
    'Custom Challenge',
    'Create your own challenge with custom metrics and goals',
    'custom',
    '[]'::jsonb,
    30,
    'target'
  )
ON CONFLICT DO NOTHING;


-- ========== 20251228164811_fix_roles_and_cleanup.sql ==========

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



-- ========== 20251228165122_fix_contest_participants_recursion.sql ==========

/*
  # Fix Contest Participants Policy Recursion

  1. Problem
    - SELECT policy on contest_participants references itself causing infinite recursion
    - Using EXISTS query on same table creates circular dependency

  2. Solution
    - Create helper function with SECURITY DEFINER to bypass RLS
    - Simplify policies to avoid self-reference
    
  3. Security
    - Helper function only checks participation status
    - All other access controls remain in place
*/

-- Drop existing policies
DROP POLICY IF EXISTS "View participants in contests" ON contest_participants;
DROP POLICY IF EXISTS "Join or admin adds members" ON contest_participants;
DROP POLICY IF EXISTS "Update participation" ON contest_participants;
DROP POLICY IF EXISTS "Leave or remove participants" ON contest_participants;

-- Create helper function to check if user is in contest (bypasses RLS)
CREATE OR REPLACE FUNCTION user_is_in_contest(check_contest_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM contest_participants
    WHERE contest_id = check_contest_id
    AND user_id = check_user_id
    AND left_at IS NULL
  );
$$;

-- Create helper function to check if user is contest admin
CREATE OR REPLACE FUNCTION user_is_contest_admin(check_contest_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM contest_participants
    WHERE contest_id = check_contest_id
    AND user_id = check_user_id
    AND role = 'admin'
    AND left_at IS NULL
  );
$$;

-- Create helper function to check if user is contest creator
CREATE OR REPLACE FUNCTION user_is_contest_creator(check_contest_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM contests
    WHERE id = check_contest_id
    AND creator_id = check_user_id
  );
$$;

-- New policies using helper functions (no recursion)
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



-- ========== 20251228165515_add_exit_reason_column.sql ==========

/*
  # Add exit_reason column to contest_participants

  1. Changes
    - Add `exit_reason` column to store why a participant left
    - Column is optional (nullable) text field
    
  2. Notes
    - Supports existing leave contest functionality in frontend
    - No security changes needed (existing RLS policies apply)
*/

-- Add exit_reason column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contest_participants' AND column_name = 'exit_reason'
  ) THEN
    ALTER TABLE contest_participants ADD COLUMN exit_reason text;
  END IF;
END $$;



-- ========== 20251228165543_create_contest_member_exits_table.sql ==========

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



-- ========== 20251228170527_add_unique_constraint_to_invite_code.sql ==========

/*
  # Add unique constraint to invite_code

  1. Changes
    - Add unique constraint to contests.invite_code column
    - Create index for faster lookups
    
  2. Notes
    - Ensures no duplicate invite codes can be created
    - Supports efficient code collision detection
    - Existing NULL values are allowed (contests without codes)
*/

-- Add unique constraint to invite_code
-- This allows NULL values but ensures non-NULL values are unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contests_invite_code_unique'
  ) THEN
    ALTER TABLE contests 
    ADD CONSTRAINT contests_invite_code_unique 
    UNIQUE (invite_code);
  END IF;
END $$;

-- Create index for faster lookups (if not already created by constraint)
CREATE INDEX IF NOT EXISTS idx_contests_invite_code ON contests(invite_code) WHERE invite_code IS NOT NULL;



-- ========== 20251228171102_fix_contests_rls_for_invite_code_lookup.sql ==========

/*
  # Fix RLS policy for invite code lookup

  1. Changes
    - Update contests SELECT policy to allow viewing contests with invite codes
    - This fixes the issue where users couldn't join contests because they couldn't view them first
    
  2. Security
    - Contests with invite codes are now discoverable (but require knowing the code)
    - This is safe because:
      - Private contests still require the exact invite code to find
      - Users still can't see contest details without being a member
      - The join flow validates the code before allowing access
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view contests" ON contests;

-- Create updated policy that allows viewing contests with invite codes
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



-- ========== 20251228171517_add_metric_type_support.sql ==========

/*
  # Add support for different metric types
  
  1. Changes
    - Metrics in contests can now be of type 'boolean' (yes/no) or 'number' (measurable)
    - Boolean metrics will be tracked as 1 (yes/done) or 0 (no/not done)
    - Number metrics will store the actual value
    
  2. Notes
    - No schema changes needed - metrics are already stored as JSONB
    - This migration documents the supported structure:
      {
        "id": "unique-id",
        "name": "metric_name",
        "label": "Display Label",
        "type": "boolean" | "number",
        "unit": "unit of measurement" (for number type)
      }
    - Metric values in submissions will store the appropriate type
*/

-- No actual schema changes needed, just documenting the structure
-- This ensures the migration history tracks this important change

COMMENT ON COLUMN contests.metrics IS 'Array of metric definitions. Each metric has: id, name, label, type (boolean|number), unit';
COMMENT ON COLUMN submissions.metric_values IS 'JSONB object mapping metric names to their values (boolean: true/false, number: numeric value)';



-- ========== 20251228172621_remove_notifications_references.sql ==========

/*
  # Remove Notifications References
  
  1. Changes
    - Drop trigger and function that reference the dropped notifications table
    - This fixes the error when deleting contests
  
  2. Notes
    - The notifications table was previously dropped but triggers still referenced it
    - Removing these triggers prevents errors during contest operations
*/

-- Drop the trigger that references notifications
DROP TRIGGER IF EXISTS trigger_notify_contest_ended ON contests;

-- Drop the function that references notifications
DROP FUNCTION IF EXISTS notify_contest_ended();



-- ========== 20251228185221_add_group_streak_tracking.sql ==========

/*
  # Add Group Streak Tracking

  1. Changes
    - Add `group_streak_count` column to contests table
    - Add `last_group_streak_date` column to track the last date everyone submitted
    
  2. Purpose
    - Track group accountability through shared streak
    - Group streak resets if any member misses more than 2 consecutive days
    - Drives collective commitment and mutual support

  3. Rules
    - Group streak increases by 1 when ALL active members submit on a given day
    - Group streak resets to 0 if ANY member misses more than 2 consecutive days
    - Only counts active members (not those who have left)
*/

-- Add group streak tracking to contests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contests' AND column_name = 'group_streak_count'
  ) THEN
    ALTER TABLE contests ADD COLUMN group_streak_count integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contests' AND column_name = 'last_group_streak_date'
  ) THEN
    ALTER TABLE contests ADD COLUMN last_group_streak_date date;
  END IF;
END $$;

-- Add comment explaining the group streak logic
COMMENT ON COLUMN contests.group_streak_count IS 'Number of consecutive days where ALL active members have submitted. Resets if any member misses more than 2 consecutive days.';
COMMENT ON COLUMN contests.last_group_streak_date IS 'The last date when all active members submitted, used to track consecutive days.';


-- ========== 20260412120000_contest_pokes.sql ==========

/*
  # Contest pokes (group nudges)

  Members can send lightweight nudges to other participants in the same challenge.
*/

CREATE TABLE IF NOT EXISTS contest_pokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contest_pokes_no_self CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS contest_pokes_contest_created_idx
  ON contest_pokes (contest_id, created_at DESC);

ALTER TABLE contest_pokes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contest_pokes_select_members"
  ON contest_pokes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = contest_pokes.contest_id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

CREATE POLICY "contest_pokes_insert_members"
  ON contest_pokes FOR INSERT TO authenticated
  WITH CHECK (
    from_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = contest_pokes.contest_id
        AND cp.user_id = from_user_id
        AND cp.left_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM contest_participants cp
      WHERE cp.contest_id = contest_pokes.contest_id
        AND cp.user_id = to_user_id
        AND cp.left_at IS NULL
    )
  );



-- ========== 20260607120000_user_templates_chat_notifications.sql ==========

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

-- Enable Realtime in Supabase Dashboard â†’ Database â†’ Publications â†’ supabase_realtime
-- for tables: contest_chat_messages, contest_pokes



-- ========== 20260607130000_fix_contests_rls_recursion.sql ==========

/*
  # Fix infinite recursion on contests SELECT policy

  The "Users can view contests" policy queried contest_participants directly.
  contest_participants policies call user_is_contest_creator(), which reads contests
  again â†’ infinite recursion.

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



-- ========== 20260607140000_harden_rls_policies.sql ==========

/*
  # Harden RLS policies â€” prevent cross-table infinite recursion

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
-- contest_participants â€” drop stale policies, keep one canonical set
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
-- submissions â€” avoid subquery on contest_participants from policy context
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
-- user_template_submissions â€” use helper instead of contests subquery
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



-- ========== 20260607150000_grant_permissions_and_contests_policies.sql ==========

/*
  # Grant table permissions + ensure contests CRUD policies

  Fresh SQL migrations create tables owned by postgres but often omit GRANTs to
  authenticated. Without GRANT, clients get "permission denied for table contests"
  (this is NOT the same as an RLS policy violation).

  Also allows challenge creators to insert themselves as admin on first join row.
*/

-- Schema access
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- All current tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Sequences (for uuid defaults / serial cols)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Helper functions used by RLS policies
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- Future tables in this project
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- contests â€” ensure INSERT/UPDATE/DELETE policies exist (71400 only fixed SELECT)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create contests" ON contests;
DROP POLICY IF EXISTS "Contest creators can update contests" ON contests;
DROP POLICY IF EXISTS "Contest creators can delete contests" ON contests;

CREATE POLICY "Users can create contests"
  ON contests FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Contest creators can update contests"
  ON contests FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Contest creators can delete contests"
  ON contests FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- contest_participants â€” creator can add self as admin when creating challenge
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Join or add members" ON contest_participants;

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



