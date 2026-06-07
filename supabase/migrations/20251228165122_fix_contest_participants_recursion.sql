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
