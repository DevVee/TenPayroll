-- ─── Migration 006: Roles & permissions tables ────────────────────────────────
-- Creates hr_roles + hr_role_permissions in the PUBLIC schema.
-- We avoid the generic name "roles" because Supabase/Postgres reserves it
-- internally (pg_roles view), which can cause "column does not exist" errors
-- when a partial run leaves a stub table behind.
--
-- Run in Supabase SQL Editor. Safe to run multiple times.

-- 0. Clean up any stub left by a failed earlier attempt at a "roles" table
--    (only drops if the table has no slug column — i.e. the wrong version)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'roles'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'roles' AND column_name = 'slug'
  ) THEN
    DROP TABLE IF EXISTS public.roles CASCADE;
  END IF;
END $$;

-- 1. Roles table
CREATE TABLE IF NOT EXISTS hr_roles (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL,
  slug        TEXT    NOT NULL UNIQUE,  -- matches UserRole union values
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,  -- system roles cannot be deleted
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Permission grants per role
CREATE TABLE IF NOT EXISTS hr_role_permissions (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    UUID    NOT NULL REFERENCES hr_roles(id) ON DELETE CASCADE,
  permission TEXT    NOT NULL,    -- e.g. 'emp_view', 'pay_generate'
  granted    BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (role_id, permission)
);

CREATE INDEX IF NOT EXISTS hr_role_perms_role_idx ON hr_role_permissions (role_id);

-- 3. Seed system roles (idempotent)
INSERT INTO hr_roles (name, slug, description, is_system)
SELECT name, slug, description, is_system FROM (VALUES
  ('Super Admin',     'super-admin',     'Unrestricted access to all modules',               true),
  ('HR Admin',        'hr-admin',        'HR operations: employees, attendance, leaves, OT',  true),
  ('Payroll Officer', 'payroll-officer', 'Payroll generation, approval, and reports',         true),
  ('Department Head', 'dept-head',       'View reports; approve leaves and OT',               true),
  ('Employee',        'employee',        'Self-service: view own records only',               true)
) AS t(name, slug, description, is_system)
WHERE NOT EXISTS (SELECT 1 FROM hr_roles WHERE hr_roles.slug = t.slug);

-- 4. Seed permission grants (idempotent — ON CONFLICT DO NOTHING)
DO $$
DECLARE
  r_super     UUID;
  r_hr        UUID;
  r_payroll   UUID;
  r_dept      UUID;
BEGIN
  SELECT id INTO r_super   FROM hr_roles WHERE slug = 'super-admin';
  SELECT id INTO r_hr      FROM hr_roles WHERE slug = 'hr-admin';
  SELECT id INTO r_payroll FROM hr_roles WHERE slug = 'payroll-officer';
  SELECT id INTO r_dept    FROM hr_roles WHERE slug = 'dept-head';
  -- 'employee' gets no permissions (all false / not listed)

  -- super-admin: every permission granted
  INSERT INTO hr_role_permissions (role_id, permission, granted)
  SELECT r_super, perm, true FROM unnest(ARRAY[
    'emp_view','emp_create','emp_edit','emp_delete',
    'att_view','att_mark','att_edit',
    'leave_view','leave_approve',
    'ot_view','ot_approve',
    'pay_view','pay_generate','pay_approve','pay_delete',
    'reports_view',
    'settings_view','settings_edit',
    'users_view','users_create','users_edit'
  ]) AS perm
  ON CONFLICT (role_id, permission) DO NOTHING;

  -- hr-admin
  INSERT INTO hr_role_permissions (role_id, permission, granted)
  SELECT r_hr, perm, true FROM unnest(ARRAY[
    'emp_view','emp_create','emp_edit','emp_delete',
    'att_view','att_mark','att_edit',
    'leave_view','leave_approve',
    'ot_view','ot_approve',
    'pay_view',
    'reports_view',
    'settings_view',
    'users_view'
  ]) AS perm
  ON CONFLICT (role_id, permission) DO NOTHING;

  -- payroll-officer
  INSERT INTO hr_role_permissions (role_id, permission, granted)
  SELECT r_payroll, perm, true FROM unnest(ARRAY[
    'emp_view',
    'att_view',
    'leave_view',
    'ot_view',
    'pay_view','pay_generate','pay_approve','pay_delete',
    'reports_view',
    'settings_view'
  ]) AS perm
  ON CONFLICT (role_id, permission) DO NOTHING;

  -- dept-head
  INSERT INTO hr_role_permissions (role_id, permission, granted)
  SELECT r_dept, perm, true FROM unnest(ARRAY[
    'emp_view',
    'att_view',
    'leave_view','leave_approve',
    'ot_view','ot_approve',
    'pay_view',
    'reports_view'
  ]) AS perm
  ON CONFLICT (role_id, permission) DO NOTHING;
END $$;

-- ── Future: wire the UI to read from hr_roles ─────────────────────────────────
-- Once a "Roles" settings tab is built, HR admins can:
--   • Create custom roles with tailored permission sets
--   • Assign employees to custom roles (add hr_role_id FK to profiles table)
-- Until then, the TypeScript ROLE_PERMISSION_PRESETS serve as the in-memory
-- fallback and this table acts as the source of truth for future migrations.
