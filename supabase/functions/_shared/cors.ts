// ============================================================
// JOBFLOW — supabase/functions/_shared/cors.ts
// Shared CORS headers for all Edge Functions. Adjust the origin
// allow-list to your deployed frontend domain(s) in production.
// ============================================================

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
