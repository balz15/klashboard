-- Run in Supabase Dashboard → SQL Editor if challenge create fails with:
-- "Could not find the 'icon' column of 'contests' in the schema cache"
--
-- Same as migration 20260609120000_contest_icons.sql

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
