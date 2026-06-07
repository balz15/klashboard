/*
  # Remove Notifications References
  
  1. Changes
    - Drop trigger and function that reference the dropped notifications table
    - This fixes the error when deleting contests
  
  2. Notes
    - The notifications table was previously dropped but triggers still referenced it
    - Removing these triggers prevents errors during contest operations
*/

-- Drop the trigger that references notifications
DROP TRIGGER IF EXISTS trigger_notify_contest_ended ON contests;

-- Drop the function that references notifications
DROP FUNCTION IF EXISTS notify_contest_ended();
