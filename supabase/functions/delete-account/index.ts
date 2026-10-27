// ============================================================
// JOBFLOW — supabase/functions/delete-account/index.ts
//
// Deletes the CALLING user's own account entirely (auth.users row
// + all owned data via ON DELETE CASCADE). This is the one function
// in the project that legitimately needs the service-role key,
// because deleting an auth.users row requires Supabase's admin API
// — RLS/anon-key access can never do this, by design.
//
// SECURITY:
//   - SUPABASE_SERVICE_ROLE_KEY is read from an Edge Function
//     secret (`supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`),
//     never from frontend code, never committed to Git.
//   - We still require and verify the caller's own JWT first, and
//     only ever delete auth.uid() from that JWT — never an id
//     passed in the request body. A user can only delete themselves.
//
// Deploy with:
//   supabase functions deploy delete-account --no-verify-jwt=false
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
// ============================================================

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header.' }, 401);

    // Step 1: verify the caller's identity using the ANON key + their JWT.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Invalid or expired session.' }, 401);

    const callerId = userData.user.id; // never trust a client-supplied id

    // Step 2: use the service-role client ONLY to delete that exact user.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(callerId);
    if (deleteErr) return json({ error: deleteErr.message }, 500);

    // profiles/companies/applications/etc. are removed automatically via
    // ON DELETE CASCADE foreign keys defined in 001_initial_schema.sql.
    return json({ success: true });
  } catch (err) {
    return json({ error: err.message || 'Unexpected error.' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
