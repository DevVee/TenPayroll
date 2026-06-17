-- ─── Dynamic Role Templates ──────────────────────────────────────────────────
-- Replaces the 5 hardcoded TypeScript roles (minus super-admin which stays).
-- Each role is a named set of fine-grained permissions.  Nav and data access
-- are driven entirely by profiles.permissions JSONB — not the role slug.
--
-- Migration steps:
--   1. Create role_templates table
--   2. Seed the 4 current built-in roles so existing users keep working
--   3. Add role_label to profiles (for future display overrides)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        UNIQUE NOT NULL,
  label       TEXT        NOT NULL,
  description TEXT,
  permissions JSONB       NOT NULL DEFAULT '{}',
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  TEXT
);

-- Role label stored per-profile (used when you want to show a display name
-- that differs from the raw slug, e.g. "Head of Finance" instead of "hr-admin")
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_label TEXT;

-- ── Row-Level Security ────────────────────────────────────────────────────────
ALTER TABLE role_templates ENABLE ROW LEVEL SECURITY;

-- Drop first so this migration is safe to re-run after a partial failure
DROP POLICY IF EXISTS "role_templates_read"        ON role_templates;
DROP POLICY IF EXISTS "role_templates_super_write" ON role_templates;

-- All authenticated users can read (needed for login + dropdowns)
CREATE POLICY "role_templates_read"
  ON role_templates FOR SELECT
  TO authenticated USING (true);

-- Only super-admin can write
CREATE POLICY "role_templates_super_write"
  ON role_templates FOR ALL
  TO authenticated
  USING   (current_user_role() = 'super-admin')
  WITH CHECK (current_user_role() = 'super-admin');

-- ── Auto-updated_at ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_role_templates_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS role_templates_ts ON role_templates;
CREATE TRIGGER role_templates_ts
  BEFORE UPDATE ON role_templates
  FOR EACH ROW EXECUTE FUNCTION update_role_templates_ts();

-- ── Seed the 4 existing built-in roles ───────────────────────────────────────
-- These mirror ROLE_PERMISSION_PRESETS in src/types/auth.ts so existing users
-- keep working.  Super-admin is intentionally absent — it's hardcoded.
INSERT INTO role_templates (slug, label, description, permissions, sort_order)
VALUES
  ('hr-admin', 'HR Admin',
   'Employee records, attendance, leaves, overtime, reports',
   '{
     "emp_view":true,"emp_create":true,"emp_edit":true,"emp_delete":true,
     "att_view":true,"att_mark":true,"att_edit":true,
     "leave_view":true,"leave_approve":true,
     "ot_view":true,"ot_approve":true,
     "pay_view":true,"pay_generate":false,"pay_approve":false,"pay_delete":false,
     "reports_view":true,
     "settings_view":true,"settings_edit":false,
     "users_view":false,"users_create":false,"users_edit":false
   }', 1),

  ('payroll-officer', 'Payroll Officer',
   'Payroll generation, approval, advances, reports',
   '{
     "emp_view":true,"emp_create":false,"emp_edit":false,"emp_delete":false,
     "att_view":true,"att_mark":false,"att_edit":false,
     "leave_view":true,"leave_approve":false,
     "ot_view":true,"ot_approve":false,
     "pay_view":true,"pay_generate":true,"pay_approve":true,"pay_delete":false,
     "reports_view":true,
     "settings_view":false,"settings_edit":false,
     "users_view":false,"users_create":false,"users_edit":false
   }', 2),

  ('dept-head', 'Department Head',
   'View team attendance, approve leave and overtime, read payroll summaries',
   '{
     "emp_view":true,"emp_create":false,"emp_edit":false,"emp_delete":false,
     "att_view":true,"att_mark":false,"att_edit":false,
     "leave_view":true,"leave_approve":true,
     "ot_view":true,"ot_approve":true,
     "pay_view":true,"pay_generate":false,"pay_approve":false,"pay_delete":false,
     "reports_view":false,
     "settings_view":false,"settings_edit":false,
     "users_view":false,"users_create":false,"users_edit":false
   }', 3),

  ('employee', 'Employee',
   'Self-service portal — view own payslips and file leave requests',
   '{
     "emp_view":false,"emp_create":false,"emp_edit":false,"emp_delete":false,
     "att_view":false,"att_mark":false,"att_edit":false,
     "leave_view":false,"leave_approve":false,
     "ot_view":false,"ot_approve":false,
     "pay_view":false,"pay_generate":false,"pay_approve":false,"pay_delete":false,
     "reports_view":false,
     "settings_view":false,"settings_edit":false,
     "users_view":false,"users_create":false,"users_edit":false
   }', 4)

ON CONFLICT (slug) DO NOTHING;
