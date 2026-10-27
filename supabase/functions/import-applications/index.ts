// ============================================================
// JOBFLOW — supabase/functions/import-applications/index.ts
//
// Optional server-side CSV import. The frontend's default CSV
// import (js/applications.js) runs entirely client-side against
// RLS-protected tables, which is sufficient for normal use. This
// function exists for the "heavier" case: very large CSV files,
// or import logic you want to keep off the client (e.g. server-side
// dedupe against existing companies, richer validation, rate limiting).
//
// SECURITY:
//   - Requires a valid user JWT in the Authorization header.
//   - Uses that JWT (not the service role key) to create a
//     Supabase client, so every insert still goes through RLS
//     under the *calling user's* identity — we do not use
//     SUPABASE_SERVICE_ROLE_KEY here at all, deliberately, since
//     RLS already gives us safe per-user isolation.
//   - Never trusts a user_id sent in the request body.
//
// Deploy with:
//   supabase functions deploy import-applications
// ============================================================

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const STATUSES = ['SAVED','APPLIED','SCREENING','INTERVIEW','TECHNICAL_INTERVIEW','OFFER','ACCEPTED','REJECTED','WITHDRAWN'];
const PRIORITIES = ['LOW','MEDIUM','HIGH'];
const WORK_MODES = ['REMOTE','HYBRID','ONSITE'];
const EMPLOYMENT_TYPES = ['FULL_TIME','PART_TIME','INTERNSHIP','CONTRACT','FREELANCE','TEMPORARY'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing Authorization header.' }, 401);
    }

    // Client scoped to the calling user's JWT — RLS still applies.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: 'Invalid or expired session.' }, 401);
    }

    const { rows } = await req.json();
    if (!Array.isArray(rows)) {
      return json({ error: 'Request body must include a "rows" array.' }, 400);
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const companyCache = new Map<string, string>();

    for (const [idx, row] of rows.entries()) {
      const companyName = (row.company_name || '').trim();
      const jobTitle = (row.job_title || '').trim();
      if (!companyName || !jobTitle) {
        skipped++;
        errors.push(`Row ${idx + 1}: missing company_name or job_title.`);
        continue;
      }

      try {
        let companyId = companyCache.get(companyName.toLowerCase());
        if (!companyId) {
          const { data: existing } = await supabase
            .from('companies').select('id').ilike('name', companyName).limit(1).maybeSingle();
          if (existing) {
            companyId = existing.id;
          } else {
            const { data: created, error: createErr } = await supabase
              .from('companies').insert({ name: companyName }).select('id').single();
            if (createErr) throw createErr;
            companyId = created.id;
          }
          companyCache.set(companyName.toLowerCase(), companyId);
        }

        const { error: insertErr } = await supabase.from('applications').insert({
          company_id: companyId,
          job_title: jobTitle,
          location: row.location || null,
          employment_type: EMPLOYMENT_TYPES.includes(row.employment_type) ? row.employment_type : null,
          work_mode: WORK_MODES.includes(row.work_mode) ? row.work_mode : null,
          status: STATUSES.includes(row.status) ? row.status : 'SAVED',
          priority: PRIORITIES.includes(row.priority) ? row.priority : 'MEDIUM',
          source: row.source || null,
          applied_at: row.applied_at || null,
          job_url: row.job_url || null,
        });
        if (insertErr) throw insertErr;
        imported++;
      } catch (err) {
        skipped++;
        errors.push(`Row ${idx + 1}: ${err.message || 'unknown error'}`);
      }
    }

    return json({ imported, skipped, errors });
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
