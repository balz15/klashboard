/*
  # Fix Function Search Paths - Version 3

  1. Security Improvements
    - Replace functions using CREATE OR REPLACE to preserve triggers
    - Set SECURITY DEFINER on all functions
    - Fix search_path to prevent SQL injection

  2. Updated Functions
    - handle_new_user (trigger function)
    - is_contest_admin (returns boolean)
    - get_contest_owner (returns uuid)
    - notify_contest_ended (trigger function)
    - set_auto_delete_at (trigger function)
*/

-- Replace handle_new_user function with proper search_path
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Replace is_contest_admin function with proper search_path
-- Need to drop first since we're changing from plpgsql to sql
DROP FUNCTION IF EXISTS is_contest_admin(uuid, uuid) CASCADE;

CREATE FUNCTION is_contest_admin(contest_uuid uuid, user_uuid uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contest_participants 
    WHERE contest_id = contest_uuid 
    AND user_id = user_uuid 
    AND role IN ('owner', 'co_admin')
  );
$$;

-- Replace get_contest_owner function with proper search_path
DROP FUNCTION IF EXISTS get_contest_owner(uuid) CASCADE;

CREATE FUNCTION get_contest_owner(contest_uuid uuid)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT user_id FROM public.contest_participants 
  WHERE contest_id = contest_uuid AND role = 'owner'
  LIMIT 1;
$$;

-- Replace notify_contest_ended function with proper search_path
CREATE OR REPLACE FUNCTION notify_contest_ended()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    SELECT 
      cp.user_id,
      'contest_ended',
      'Contest Ended: ' || NEW.name,
      'The contest "' || NEW.name || '" has ended. Check the final results!',
      '/contest/' || NEW.id
    FROM public.contest_participants cp
    WHERE cp.contest_id = NEW.id
    AND cp.left_at IS NULL
    AND cp.user_id != NEW.creator_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Replace set_auto_delete_at function with proper search_path
CREATE OR REPLACE FUNCTION set_auto_delete_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    IF NEW.auto_delete_at IS NULL THEN
      NEW.auto_delete_at := NEW.end_date + INTERVAL '30 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;