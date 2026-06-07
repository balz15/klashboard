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
