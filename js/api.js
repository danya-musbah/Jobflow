// ============================================================
// JOBFLOW — js/api.js
// Every Supabase query in the app lives here. UI modules never
// talk to `supabase` directly — they call these functions.
// All functions rely on RLS (auth.uid()) for authorization; none
// of them need to pass a user_id explicitly for filtering reads,
// though inserts do stamp user_id so RLS's WITH CHECK can verify it.
// ============================================================

import { supabase } from './supabase.js';

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Not authenticated.');
  return data.user.id;
}

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

/* ============================================================
   PROFILES
   ============================================================ */
export async function getProfile() {
  const uid = await currentUserId();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(patch) {
  const uid = await currentUserId();
  return unwrap(await supabase.from('profiles').update(patch).eq('id', uid).select().single());
}

/* ============================================================
   COMPANIES
   ============================================================ */
export async function getCompanies({ search = '' } = {}) {
  let query = supabase.from('companies').select('*').order('name', { ascending: true });
  if (search) query = query.ilike('name', `%${search}%`);
  return unwrap(await query);
}

export async function getCompany(id) {
  return unwrap(await supabase.from('companies').select('*').eq('id', id).single());
}

export async function createCompany(payload) {
  const uid = await currentUserId();
  return unwrap(await supabase.from('companies').insert({ ...payload, user_id: uid }).select().single());
}

/** Find an existing company by exact name (case-insensitive) or create a new one. Used by the Add Application form. */
export async function findOrCreateCompany(name) {
  const trimmed = name.trim();
  const { data: existing, error: findErr } = await supabase
    .from('companies')
    .select('*')
    .ilike('name', trimmed)
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing;
  return createCompany({ name: trimmed });
}

export async function updateCompany(id, patch) {
  return unwrap(await supabase.from('companies').update(patch).eq('id', id).select().single());
}

export async function deleteCompany(id) {
  const { error } = await supabase.from('companies').delete().eq('id', id);
  if (error) throw error;
}

/* ============================================================
   APPLICATIONS
   ============================================================ */

/**
 * Fetch a paginated, filtered, sorted list of applications with the
 * joined company name. Uses Supabase's range() for server-side
 * pagination (never downloads the whole table).
 */
export async function getApplications({
  page = 1,
  pageSize = 20,
  search = '',
  status = '',
  priority = '',
  workMode = '',
  employmentType = '',
  companyId = '',
  source = '',
  sortBy = 'updated_at',
  sortDir = 'desc',
} = {}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('applications')
    .select('*, companies(id, name, website, industry, location)', { count: 'exact' });

  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (workMode) query = query.eq('work_mode', workMode);
  if (employmentType) query = query.eq('employment_type', employmentType);
  if (companyId) query = query.eq('company_id', companyId);
  if (source) query = query.eq('source', source);
  if (search) {
    // Search across job title / location / contact — companies are joined
    // client-side-filterable via the FK, but ilike works fine here on
    // applications' own text columns.
    query = query.or(
      `job_title.ilike.%${search}%,location.ilike.%${search}%,contact_name.ilike.%${search}%,description.ilike.%${search}%`
    );
  }

  query = query.order(sortBy, { ascending: sortDir === 'asc' }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

/** Fetch ALL applications for the current user (used by Kanban + export + analytics). */
export async function getAllApplicationsForUser() {
  return unwrap(
    await supabase
      .from('applications')
      .select('*, companies(id, name, website, industry, location)')
      .order('updated_at', { ascending: false })
  );
}

export async function getApplication(id) {
  return unwrap(
    await supabase
      .from('applications')
      .select('*, companies(id, name, website, industry, location, notes)')
      .eq('id', id)
      .single()
  );
}

export async function createApplication(payload) {
  const uid = await currentUserId();
  const app = unwrap(
    await supabase.from('applications').insert({ ...payload, user_id: uid }).select().single()
  );
  await logActivity(app.id, 'APPLICATION_CREATED', `Application created for ${payload.job_title}`);
  return app;
}

export async function updateApplication(id, patch, { silent = false } = {}) {
  const app = unwrap(await supabase.from('applications').update(patch).eq('id', id).select().single());
  // Note: STATUS_CHANGED activity rows are written automatically by a DB
  // trigger (see 004_triggers.sql). We only log a generic "updated" event
  // here for non-status edits, to avoid duplicate noise.
  if (!silent && !('status' in patch)) {
    await logActivity(id, 'APPLICATION_UPDATED', 'Application details updated');
  }
  return app;
}

export async function updateApplicationStatus(id, status) {
  // The status-change activity row is created by the DB trigger automatically.
  return unwrap(await supabase.from('applications').update({ status }).eq('id', id).select().single());
}

export async function deleteApplication(id) {
  const { error } = await supabase.from('applications').delete().eq('id', id);
  if (error) throw error;
}

/* ============================================================
   INTERVIEWS
   ============================================================ */
export async function getInterviews({ upcoming = null } = {}) {
  let query = supabase
    .from('interviews')
    .select('*, applications(id, job_title, companies(name))')
    .order('scheduled_at', { ascending: true });
  if (upcoming === true) query = query.gte('scheduled_at', new Date().toISOString());
  if (upcoming === false) query = query.lt('scheduled_at', new Date().toISOString());
  return unwrap(await query);
}

export async function getInterviewsForApplication(applicationId) {
  return unwrap(
    await supabase
      .from('interviews')
      .select('*')
      .eq('application_id', applicationId)
      .order('scheduled_at', { ascending: true })
  );
}

export async function createInterview(payload) {
  const uid = await currentUserId();
  const interview = unwrap(
    await supabase.from('interviews').insert({ ...payload, user_id: uid }).select().single()
  );
  await logActivity(payload.application_id, 'INTERVIEW_CREATED', `${humanizeType(payload.type)} scheduled`);
  return interview;
}

export async function updateInterview(id, patch) {
  const interview = unwrap(await supabase.from('interviews').update(patch).eq('id', id).select().single());
  await logActivity(interview.application_id, 'INTERVIEW_UPDATED', 'Interview updated');
  return interview;
}

export async function deleteInterview(id) {
  const { error } = await supabase.from('interviews').delete().eq('id', id);
  if (error) throw error;
}

function humanizeType(type) {
  return String(type || '').toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/* ============================================================
   CONTACTS
   ============================================================ */
export async function getContacts({ search = '', companyId = '' } = {}) {
  let query = supabase.from('contacts').select('*, companies(id, name)').order('name', { ascending: true });
  if (companyId) query = query.eq('company_id', companyId);
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,position.ilike.%${search}%`);
  return unwrap(await query);
}

export async function createContact(payload) {
  const uid = await currentUserId();
  return unwrap(await supabase.from('contacts').insert({ ...payload, user_id: uid }).select().single());
}

export async function updateContact(id, patch) {
  return unwrap(await supabase.from('contacts').update(patch).eq('id', id).select().single());
}

export async function deleteContact(id) {
  const { error } = await supabase.from('contacts').delete().eq('id', id);
  if (error) throw error;
}

/* ============================================================
   NOTES
   ============================================================ */
export async function getNotesForApplication(applicationId) {
  return unwrap(
    await supabase.from('notes').select('*').eq('application_id', applicationId).order('created_at', { ascending: false })
  );
}

export async function createNote(applicationId, content) {
  const uid = await currentUserId();
  const note = unwrap(
    await supabase.from('notes').insert({ application_id: applicationId, content, user_id: uid }).select().single()
  );
  await logActivity(applicationId, 'NOTE_ADDED', 'Note added');
  return note;
}

export async function deleteNote(id) {
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
}

/* ============================================================
   REMINDERS
   ============================================================ */
export async function getReminders({ completed = null } = {}) {
  let query = supabase
    .from('reminders')
    .select('*, applications(id, job_title, companies(name))')
    .order('remind_at', { ascending: true });
  if (completed !== null) query = query.eq('completed', completed);
  return unwrap(await query);
}

export async function createReminder(payload) {
  const uid = await currentUserId();
  const reminder = unwrap(
    await supabase.from('reminders').insert({ ...payload, user_id: uid }).select().single()
  );
  if (payload.application_id) {
    await logActivity(payload.application_id, 'REMINDER_CREATED', `Reminder set: ${payload.title}`);
  }
  return reminder;
}

export async function completeReminder(id, completed = true) {
  const reminder = unwrap(
    await supabase.from('reminders').update({ completed }).eq('id', id).select().single()
  );
  if (completed && reminder.application_id) {
    await logActivity(reminder.application_id, 'REMINDER_COMPLETED', `Reminder completed: ${reminder.title}`);
  }
  return reminder;
}

export async function deleteReminder(id) {
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw error;
}

/* ============================================================
   ACTIVITY
   ============================================================ */
export async function getActivityForApplication(applicationId) {
  return unwrap(
    await supabase
      .from('application_activity')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
  );
}

export async function logActivity(applicationId, activityType, description) {
  const uid = await currentUserId();
  const { error } = await supabase.from('application_activity').insert({
    user_id: uid,
    application_id: applicationId,
    activity_type: activityType,
    description,
  });
  // Activity logging is best-effort — never block the primary action on it.
  if (error) console.warn('[JobFlow] activity log failed:', error.message);
}

/* ============================================================
   ANALYTICS
   All computed client-side from the user's own rows (already
   scoped by RLS), which is fine at this data scale. For heavier
   aggregation at larger scale, see supabase/functions/analytics.
   ============================================================ */
export async function getAnalytics() {
  const applications = await getAllApplicationsForUser();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const total = applications.length;
  const thisMonth = applications.filter((a) => new Date(a.created_at) >= startOfMonth).length;

  const byStatus = {};
  const bySource = {};
  const byEmploymentType = {};
  const byWorkMode = {};
  const byCompany = {};
  const overTime = {}; // "2026-01" => count

  for (const a of applications) {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    if (a.source) bySource[a.source] = (bySource[a.source] || 0) + 1;
    if (a.employment_type) byEmploymentType[a.employment_type] = (byEmploymentType[a.employment_type] || 0) + 1;
    if (a.work_mode) byWorkMode[a.work_mode] = (byWorkMode[a.work_mode] || 0) + 1;
    const companyName = a.companies?.name || 'Unknown';
    byCompany[companyName] = (byCompany[companyName] || 0) + 1;
    const monthKey = new Date(a.created_at).toISOString().slice(0, 7);
    overTime[monthKey] = (overTime[monthKey] || 0) + 1;
  }

  const interviewedStatuses = ['INTERVIEW', 'TECHNICAL_INTERVIEW', 'OFFER', 'ACCEPTED'];
  const interviewed = applications.filter((a) => interviewedStatuses.includes(a.status)).length;
  const offers = applications.filter((a) => ['OFFER', 'ACCEPTED'].includes(a.status)).length;
  const accepted = applications.filter((a) => a.status === 'ACCEPTED').length;
  const rejected = applications.filter((a) => a.status === 'REJECTED').length;
  const appliedOrLater = applications.filter((a) => a.status !== 'SAVED').length;

  const pct = (num, denom) => (denom > 0 ? Math.round((num / denom) * 1000) / 10 : null);

  // Interview conversion rate per source, for insight generation
  const sourceConversion = {};
  for (const src of Object.keys(bySource)) {
    const srcApps = applications.filter((a) => a.source === src);
    const srcInterviewed = srcApps.filter((a) => interviewedStatuses.includes(a.status)).length;
    sourceConversion[src] = { total: srcApps.length, rate: pct(srcInterviewed, srcApps.length) };
  }

  return {
    total,
    thisMonth,
    interviews: applications.filter((a) => interviewedStatuses.includes(a.status) || a.status === 'REJECTED').length,
    interviewedCount: interviewed,
    offers,
    accepted,
    rejected,
    responseRate: pct(appliedOrLater - applications.filter((a) => a.status === 'APPLIED').length + applications.filter((a) => a.status === 'APPLIED').length, appliedOrLater),
    interviewRate: pct(interviewed, appliedOrLater),
    offerRate: pct(offers, appliedOrLater),
    byStatus,
    bySource,
    byEmploymentType,
    byWorkMode,
    byCompany,
    overTime,
    sourceConversion,
    applications,
  };
}

/* ============================================================
   DASHBOARD METRICS (lighter-weight subset of analytics)
   ============================================================ */
export async function getDashboardMetrics() {
  const applications = await getAllApplicationsForUser();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const total = applications.length;
  const thisMonth = applications.filter((a) => new Date(a.created_at) >= startOfMonth).length;
  const interviewStatuses = ['INTERVIEW', 'TECHNICAL_INTERVIEW'];
  const interviews = applications.filter((a) => interviewStatuses.includes(a.status)).length;
  const offers = applications.filter((a) => a.status === 'OFFER').length;
  const accepted = applications.filter((a) => a.status === 'ACCEPTED').length;
  const rejected = applications.filter((a) => a.status === 'REJECTED').length;
  const appliedOrLater = applications.filter((a) => a.status !== 'SAVED').length;
  const respondedStatuses = ['SCREENING', 'INTERVIEW', 'TECHNICAL_INTERVIEW', 'OFFER', 'ACCEPTED', 'REJECTED'];
  const responded = applications.filter((a) => respondedStatuses.includes(a.status)).length;

  const pct = (num, denom) => (denom > 0 ? Math.round((num / denom) * 1000) / 10 : 0);

  return {
    total,
    thisMonth,
    interviews,
    offers,
    accepted,
    rejected,
    responseRate: pct(responded, appliedOrLater),
    interviewRate: pct(interviews + offers + accepted, appliedOrLater),
    offerRate: pct(offers + accepted, appliedOrLater),
    applications,
  };
}

/* ============================================================
   FUNNEL (for dashboard funnel chart)
   ============================================================ */
export async function getFunnelData() {
  const applications = await getAllApplicationsForUser();
  const stageOrder = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'ACCEPTED'];
  // An application "reached" a stage if its current status is that stage
  // or any later stage in the pipeline (accepted counts as having passed offer, etc).
  const rank = (status) => {
    const idx = stageOrder.indexOf(status);
    if (idx !== -1) return idx;
    if (status === 'TECHNICAL_INTERVIEW') return stageOrder.indexOf('INTERVIEW');
    return -1; // SAVED, REJECTED, WITHDRAWN don't count toward the funnel's "reached" logic directly
  };
  return stageOrder.map((stage) => {
    const stageRank = stageOrder.indexOf(stage);
    const count = applications.filter((a) => {
      const r = rank(a.status);
      return r >= stageRank;
    }).length;
    return { stage, count };
  });
}

/* ============================================================
   REMINDERS GROUPED (Today / Tomorrow / Upcoming / Overdue)
   ============================================================ */
export async function getGroupedReminders() {
  const all = await getReminders();
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTomorrow = new Date(startToday.getTime() + 86400000);
  const startDayAfter = new Date(startTomorrow.getTime() + 86400000);

  const groups = { overdue: [], today: [], tomorrow: [], upcoming: [], completed: [] };
  for (const r of all) {
    if (r.completed) { groups.completed.push(r); continue; }
    const t = new Date(r.remind_at);
    if (t < startToday) groups.overdue.push(r);
    else if (t < startTomorrow) groups.today.push(r);
    else if (t < startDayAfter) groups.tomorrow.push(r);
    else groups.upcoming.push(r);
  }
  return groups;
}
