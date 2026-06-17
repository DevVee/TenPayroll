-- ══════════════════════════════════════════════════════════════════════════════
-- TenPayroll — Create Super-Admin Account
-- Run this ENTIRE file in: Supabase Dashboard → SQL Editor
-- Safe to re-run anytime. Creates everything needed for first login.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Step 1: Create the profile RPC function ───────────────────────────────────
-- SECURITY DEFINER = runs as DB owner, bypasses RLS completely.
-- This is WHY loadProfile works regardless of RLS policy configuration.
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT row_to_json(p)
  FROM profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

-- ── Step 2: Create the admin user ─────────────────────────────────────────────
DO $$
DECLARE
  v_uid UUID;
BEGIN
  -- Remove any orphaned profiles then remove the auth user cleanly
  DELETE FROM profiles   WHERE id NOT IN (SELECT id FROM auth.users);
  DELETE FROM profiles   WHERE role = 'super-admin';
  DELETE FROM auth.users WHERE email = 'admin@tenpayroll.ph';

  -- Insert auth user and capture the UUID via RETURNING
  -- (no SELECT needed — avoids the timing/UUID mismatch bug)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user, is_anonymous,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, phone_change, phone_change_token,
    email_change_token_current, email_change_confirm_status,
    reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated', 'authenticated',
    'admin@tenpayroll.ph',
    crypt('Admin@2026!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"TenPayroll Admin"}',
    FALSE, FALSE, FALSE,
    NOW(), NOW(),
    '', '', '', '', '', '', '', 0, ''
  )
  RETURNING id INTO v_uid;

  -- Insert profile with ON CONFLICT so it can never fail
  INSERT INTO profiles (id, name, role, avatar_initials)
  VALUES (v_uid, 'TenPayroll Admin', 'super-admin', 'TA')
  ON CONFLICT (id) DO UPDATE SET
    name           = 'TenPayroll Admin',
    role           = 'super-admin',
    avatar_initials = 'TA';

  RAISE NOTICE '✅ Admin created — UUID: %', v_uid;

END $$;

-- ── Step 3: Verify ────────────────────────────────────────────────────────────
-- Must show 1 row with confirmed=true and role=super-admin before logging in.
SELECT
  u.email,
  u.email_confirmed_at IS NOT NULL  AS confirmed,
  p.role,
  p.name,
  '✅ Ready to login'               AS status
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE u.email = 'admin@tenpayroll.ph';
