-- Allow signed-in users to permanently delete their own account and linked data.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Clear optional FKs to auth.users that do not cascade on delete
  UPDATE public.challenge_templates
  SET submitted_by = NULL
  WHERE submitted_by = uid;

  UPDATE public.user_template_submissions
  SET reviewed_by = NULL
  WHERE reviewed_by = uid;

  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
