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
