// ─── Backend Configuration ─────────────────────────────────────────────────────
// THIS IS THE ONLY FILE YOU NEED TO CHANGE to point to a different Supabase
// project or a completely different backend.
//
// To transfer to a new Supabase project:
//   1. Update VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.
//   2. Run the schema + seed SQL on the new project.
//   3. Done — no other code changes needed.

export const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL  as string
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Guard — fail fast in dev if env vars are missing
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[Veltrix] Missing Supabase env vars.\n' +
    'Create a .env file at the project root with:\n' +
    '  VITE_SUPABASE_URL=https://xxx.supabase.co\n' +
    '  VITE_SUPABASE_ANON_KEY=your-anon-key'
  )
}
