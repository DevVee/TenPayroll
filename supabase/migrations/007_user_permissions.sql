-- 007_user_permissions.sql
-- Add granular permissions JSONB column to profiles table.
-- When null/empty, the application falls back to role-based presets.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN profiles.permissions IS
  'Granular per-action permission overrides. When empty, role presets apply.
   Keys: emp_view, emp_create, emp_edit, emp_delete,
         att_view, att_mark, att_edit,
         leave_view, leave_approve,
         ot_view, ot_approve,
         pay_view, pay_generate, pay_approve, pay_delete,
         reports_view, settings_view, settings_edit,
         users_view, users_create, users_edit';
