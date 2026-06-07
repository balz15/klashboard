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
