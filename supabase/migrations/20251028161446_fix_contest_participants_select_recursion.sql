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
