// ============================================================
// JOBFLOW — config.example.js — copy to js/config.js
//
// Fill these in with YOUR Supabase project's public values.
// Find them in: Supabase Dashboard → Project Settings → API.
//
// SAFE to expose in the browser:
//   - SUPABASE_URL
//   - SUPABASE_ANON_KEY (a.k.a. "publishable"/"anon" key)
// These are protected by Row Level Security (see supabase/migrations).
//
// NEVER put SUPABASE_SERVICE_ROLE_KEY here or anywhere in frontend
// code. It bypasses RLS entirely and must only live inside Supabase
// Edge Functions (as a server-side secret) — never in Git, never
// in the browser.
// ============================================================

export const SUPABASE_URL = "https://example-project.supabase.co";
export const SUPABASE_ANON_KEY = "your-anon-key-here";

// Used for CSV/JSON export filenames, page title, etc.
export const APP_NAME = "JobFlow";

// Default pagination size (can be overridden per-user in Settings)
export const DEFAULT_PAGE_SIZE = 20;
