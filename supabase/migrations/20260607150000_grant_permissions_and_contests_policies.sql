/*
  # Grant table permissions + ensure contests CRUD policies

  Fresh SQL migrations create tables owned by postgres but often omit GRANTs to
  authenticated. Without GRANT, clients get "permission denied for table contests"
  (this is NOT the same as an RLS policy violation).

  Also allows challenge creators to insert themselves as admin on first join row.
*/

-- Schema access
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- All current tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Sequences (for uuid defaults / serial cols)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Helper functions used by RLS policies
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- Future tables in this project
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- contests — ensure INSERT/UPDATE/DELETE policies exist (71400 only fixed SELECT)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create contests" ON contests;
DROP POLICY IF EXISTS "Contest creators can update contests" ON contests;
DROP POLICY IF EXISTS "Contest creators can delete contests" ON contests;

CREATE POLICY "Users can create contests"
  ON contests FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Contest creators can update contests"
  ON contests FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Contest creators can delete contests"
  ON contests FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- contest_participants — creator can add self as admin when creating challenge
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Join or add members" ON contest_participants;

CREATE POLICY "Join or add members"
  ON contest_participants FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND role = 'participant')
    OR (
      user_id = auth.uid()
      AND role = 'admin'
      AND user_is_contest_creator(contest_id, auth.uid())
    )
    OR user_is_contest_admin(contest_id, auth.uid())
    OR user_is_contest_creator(contest_id, auth.uid())
  );
