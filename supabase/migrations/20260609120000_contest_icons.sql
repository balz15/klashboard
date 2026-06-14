/*
  Challenge icons: preset keys + optional custom image URL
*/

ALTER TABLE contests ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'target';
ALTER TABLE contests ADD COLUMN IF NOT EXISTS icon_url text;

ALTER TABLE user_template_submissions ADD COLUMN IF NOT EXISTS icon_url text;
ALTER TABLE challenge_templates ADD COLUMN IF NOT EXISTS icon_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contest-icons',
  'contest-icons',
  true,
  204800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "contest_icons_public_read" ON storage.objects;
CREATE POLICY "contest_icons_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'contest-icons');

DROP POLICY IF EXISTS "contest_icons_insert_own" ON storage.objects;
CREATE POLICY "contest_icons_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'contest-icons'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "contest_icons_update_own" ON storage.objects;
CREATE POLICY "contest_icons_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'contest-icons'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "contest_icons_delete_own" ON storage.objects;
CREATE POLICY "contest_icons_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'contest-icons'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

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
    icon_url,
    submitted_by,
    source_contest_id
  ) VALUES (
    v_sub.name,
    v_sub.description,
    'user_created',
    v_sub.default_metrics,
    v_sub.suggested_duration_days,
    COALESCE(v_sub.icon, 'target'),
    v_sub.icon_url,
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
