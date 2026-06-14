/*
  Template approval RPC — runs with definer rights so admins can publish templates
  when RLS blocks direct client updates.

  After applying, grant yourself admin once:
  UPDATE profiles SET is_app_admin = true WHERE email = 'your@email.com';
*/

CREATE OR REPLACE FUNCTION public.approve_user_template_submission(p_submission_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub user_template_submissions%ROWTYPE;
  v_template_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_app_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized to approve templates';
  END IF;

  SELECT * INTO v_sub
  FROM user_template_submissions
  WHERE id = p_submission_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending submission not found';
  END IF;

  INSERT INTO challenge_templates (
    name,
    description,
    category,
    default_metrics,
    suggested_duration_days,
    icon,
    submitted_by,
    source_contest_id
  ) VALUES (
    v_sub.name,
    v_sub.description,
    'user_created',
    v_sub.default_metrics,
    v_sub.suggested_duration_days,
    COALESCE(v_sub.icon, 'target'),
    v_sub.submitted_by,
    v_sub.contest_id
  )
  RETURNING id INTO v_template_id;

  UPDATE user_template_submissions
  SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    published_template_id = v_template_id
  WHERE id = p_submission_id;

  RETURN v_template_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_user_template_submission(
  p_submission_id uuid,
  p_review_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_app_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized to reject templates';
  END IF;

  UPDATE user_template_submissions
  SET
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = p_review_note
  WHERE id = p_submission_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending submission not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_user_template_submission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_user_template_submission(uuid, text) TO authenticated;
