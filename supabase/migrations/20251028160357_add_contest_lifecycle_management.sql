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
