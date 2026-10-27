// ============================================================
// JOBFLOW — supabase/functions/analytics/index.ts
//
// Server-side analytics aggregation. The frontend computes
// dashboard/analytics numbers client-side (js/api.js) by default,
// which is simple and fine at typical personal-use data volumes.
// This function exists for heavier aggregation you'd rather not
// ship as raw rows to the browser (e.g. computing over a very
// large application history, or combining with other privileged
// data in the future). Runs under the calling user's own JWT, so
// RLS still scopes every query to that user's own rows only.
//
// Deploy with:
//   supabase functions deploy analytics
// ============================================================

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header.' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Invalid or expired session.' }, 401);

    const { data: applications, error } = await supabase
      .from('applications')
      .select('status, priority, source, employment_type, work_mode, created_at, company_id');
    if (error) return json({ error: error.message }, 500);

    const total = applications.length;
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const a of applications) {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      if (a.source) bySource[a.source] = (bySource[a.source] || 0) + 1;
    }

    const interviewedStatuses = ['INTERVIEW', 'TECHNICAL_INTERVIEW', 'OFFER', 'ACCEPTED'];
    const interviewed = applications.filter((a) => interviewedStatuses.includes(a.status)).length;
    const offers = applications.filter((a) => ['OFFER', 'ACCEPTED'].includes(a.status)).length;
    const appliedOrLater = applications.filter((a) => a.status !== 'SAVED').length;
    const pct = (num: number, denom: number) => (denom > 0 ? Math.round((num / denom) * 1000) / 10 : null);

    return json({
      total,
      byStatus,
      bySource,
      interviewRate: pct(interviewed, appliedOrLater),
      offerRate: pct(offers, appliedOrLater),
    });
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
