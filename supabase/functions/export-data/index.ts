// ============================================================
// JOBFLOW — supabase/functions/export-data/index.ts
//
// Server-side export of the calling user's full dataset as JSON
// or CSV. Like import-applications, this runs under the calling
// user's own JWT (not the service role key), so RLS guarantees
// the export can only ever contain that user's own rows — even
// though the query looks like it reads "everything".
//
// Request body: { "format": "json" | "csv", "table": "applications" | "all" }
//
// Deploy with:
//   supabase functions deploy export-data
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

    const { format = 'json', table = 'applications' } = await req.json().catch(() => ({}));

    const tables = table === 'all'
      ? ['companies', 'applications', 'interviews', 'contacts', 'notes', 'reminders', 'application_activity']
      : [table];

    const result: Record<string, unknown> = {};
    for (const t of tables) {
      const { data, error } = await supabase.from(t).select('*');
      if (error) return json({ error: `Failed to read ${t}: ${error.message}` }, 500);
      result[t] = data;
    }

    if (format === 'csv' && table !== 'all') {
      const rows = result[table] as Record<string, unknown>[];
      const csv = toCsv(rows);
      return new Response(csv, {
        headers: { ...corsHeaders, 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="jobflow-${table}.csv"` },
      });
    }

    return json(table === 'all' ? result : result[table]);
  } catch (err) {
    return json({ error: err.message || 'Unexpected error.' }, 500);
  }
});

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = (val: unknown) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => escapeCell(row[h])).join(','));
  return lines.join('\n');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
