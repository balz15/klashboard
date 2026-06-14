-- Run once in Supabase SQL Editor (Dashboard → SQL → New query)
-- Grants template approval rights in the database (required; email in .env alone is not enough)

UPDATE profiles
SET is_app_admin = true
WHERE email = 'balajee.varradan@gmail.com';

-- Optional: verify
SELECT id, email, is_app_admin FROM profiles WHERE email = 'balajee.varradan@gmail.com';
