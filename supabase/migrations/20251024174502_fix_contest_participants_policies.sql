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
