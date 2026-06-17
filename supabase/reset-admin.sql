-- ══════════════════════════════════════════════════════════════════════════════
-- TenPayroll — Reset: delete all users, create fresh super-admin
-- Run this in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Wipe all existing auth users (cascades to profiles via ON DELETE CASCADE)
DELETE FROM auth.users;

-- 2. Create the new super-admin user in Supabase Auth
--    crypt() uses bcrypt (pgcrypto extension, already enabled in schema.sql)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@tenpayroll.ph',
  crypt('tenpayroll2026', gen_salt('bf')),
  NOW(),                                    -- email already confirmed
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW(),
  '', '', '', ''
);

-- 3. Create the profile row linking the auth user to the super-admin role
INSERT INTO profiles (id, name, role, avatar_initials)
SELECT id, 'TenPayroll Admin', 'super-admin', 'TA'
FROM auth.users
WHERE email = 'admin@tenpayroll.ph';

-- Done. You can now log in with:
--   Email:    admin@tenpayroll.ph
--   Password: tenpayroll2026
