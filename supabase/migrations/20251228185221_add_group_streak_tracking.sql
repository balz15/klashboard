/*
  # Add Group Streak Tracking

  1. Changes
    - Add `group_streak_count` column to contests table
    - Add `last_group_streak_date` column to track the last date everyone submitted
    
  2. Purpose
    - Track group accountability through shared streak
    - Group streak resets if any member misses more than 2 consecutive days
    - Drives collective commitment and mutual support

  3. Rules
    - Group streak increases by 1 when ALL active members submit on a given day
    - Group streak resets to 0 if ANY member misses more than 2 consecutive days
    - Only counts active members (not those who have left)
*/

-- Add group streak tracking to contests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contests' AND column_name = 'group_streak_count'
  ) THEN
    ALTER TABLE contests ADD COLUMN group_streak_count integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contests' AND column_name = 'last_group_streak_date'
  ) THEN
    ALTER TABLE contests ADD COLUMN last_group_streak_date date;
  END IF;
END $$;

-- Add comment explaining the group streak logic
COMMENT ON COLUMN contests.group_streak_count IS 'Number of consecutive days where ALL active members have submitted. Resets if any member misses more than 2 consecutive days.';
COMMENT ON COLUMN contests.last_group_streak_date IS 'The last date when all active members submitted, used to track consecutive days.';