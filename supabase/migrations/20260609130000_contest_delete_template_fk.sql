/*
  Allow deleting a contest after it was published as a user template.
  The community template stays; only the link back to the original contest is cleared.
*/

ALTER TABLE challenge_templates
  DROP CONSTRAINT IF EXISTS challenge_templates_source_contest_id_fkey;

ALTER TABLE challenge_templates
  ADD CONSTRAINT challenge_templates_source_contest_id_fkey
  FOREIGN KEY (source_contest_id) REFERENCES contests(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.detach_contest_from_templates(p_contest_id uuid)
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
    SELECT 1 FROM contests c
    WHERE c.id = p_contest_id AND c.creator_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_app_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE challenge_templates
  SET source_contest_id = NULL
  WHERE source_contest_id = p_contest_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detach_contest_from_templates(uuid) TO authenticated;
