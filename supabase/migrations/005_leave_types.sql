-- ─── Migration 005: Leave types table ────────────────────────────────────────
-- Creates a leave_types reference table so HR can configure leave policies
-- (paid/unpaid, max days, approval required) without code changes.
--
-- The existing leave_requests.leave_type TEXT column remains; a future
-- migration can add a leave_type_id FK once the UI is updated.
--
-- Run in Supabase SQL Editor. Safe to run multiple times.

CREATE TABLE IF NOT EXISTS leave_types (
  id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT      NOT NULL UNIQUE,  -- matches LeaveType union values
  name              TEXT      NOT NULL,
  is_paid           BOOLEAN   NOT NULL DEFAULT true,
  max_days_per_year INTEGER,                    -- NULL = no cap
  requires_approval BOOLEAN   NOT NULL DEFAULT true,
  is_active         BOOLEAN   NOT NULL DEFAULT true,
  sort_order        SMALLINT  NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with the seven leave types currently in the TypeScript union.
-- INSERT … WHERE NOT EXISTS keeps the seed idempotent.
INSERT INTO leave_types (code, name, is_paid, max_days_per_year, requires_approval, sort_order)
SELECT code, name, is_paid, max_days_per_year, requires_approval, sort_order FROM (VALUES
  ('vacation',    'Vacation Leave',    true,  15,   true,  1),
  ('sick',        'Sick Leave',        true,  15,   false, 2),
  ('emergency',   'Emergency Leave',   true,   3,   true,  3),
  ('maternity',   'Maternity Leave',   true, 105,   true,  4),
  ('paternity',   'Paternity Leave',   true,   7,   true,  5),
  ('bereavement', 'Bereavement Leave', true,   3,   true,  6),
  ('unpaid',      'Unpaid Leave',      false, NULL, true,  7)
) AS t(code, name, is_paid, max_days_per_year, requires_approval, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM leave_types WHERE leave_types.code = t.code);

-- ── Future: add FK column to leave_requests ───────────────────────────────────
-- ALTER TABLE leave_requests
--   ADD COLUMN IF NOT EXISTS leave_type_id UUID REFERENCES leave_types(id);
-- UPDATE leave_requests lr
--   SET leave_type_id = lt.id
--   FROM leave_types lt WHERE lr.leave_type = lt.code;
