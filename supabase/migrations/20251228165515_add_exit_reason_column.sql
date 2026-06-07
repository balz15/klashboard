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
