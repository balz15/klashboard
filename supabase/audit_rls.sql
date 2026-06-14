-- Run in Supabase SQL Editor to audit RLS policies on live database.
-- Look for policies whose qual/with_check references other app tables directly.

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual AS using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'contests',
    'contest_participants',
    'submissions',
    'challenge_templates',
    'user_template_submissions',
    'contest_pokes',
    'contest_chat_messages',
    'contest_chat_reactions',
    'contest_member_exits'
  )
ORDER BY tablename, policyname;

-- Policies that still subquery contest_participants from contests (recursion risk):
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'contests'
  AND (
    qual ILIKE '%contest_participants%'
    OR with_check ILIKE '%contest_participants%'
  );

-- Policies that subquery contests from contest_participants (pair with above = loop):
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'contest_participants'
  AND (
    qual ILIKE '%contests%'
    OR with_check ILIKE '%contests%'
  );

-- Helper functions (should exist after migrations):
SELECT proname
FROM pg_proc
WHERE proname IN (
  'user_is_in_contest',
  'user_is_contest_admin',
  'user_is_contest_creator',
  'user_owns_participant',
  'contest_chat_allowed',
  'handle_new_user'
)
ORDER BY proname;
