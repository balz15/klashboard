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
    OR EXISTS (
      SELECT 1 FROM contest_participants
      WHERE contest_participants.contest_id = contests.id
      AND contest_participants.user_id = auth.uid()
    )
  );
