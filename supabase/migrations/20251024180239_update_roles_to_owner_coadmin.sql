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
