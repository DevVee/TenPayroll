-- ─── Migration 008: Add email column to profiles ─────────────────────────────
-- Allows User Management to display email addresses in the user list.
-- Run this once in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
