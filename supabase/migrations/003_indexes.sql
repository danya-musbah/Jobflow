-- ============================================================
-- JOBFLOW - 003_indexes.sql
-- Indexes for the query patterns used by the frontend
-- (dashboard metrics, filters, sorting, pagination, search).
-- ============================================================

-- applications
create index if not exists idx_applications_user_id on public.applications(user_id);
create index if not exists idx_applications_status on public.applications(status);
create index if not exists idx_applications_priority on public.applications(priority);
create index if not exists idx_applications_applied_at on public.applications(applied_at);
create index if not exists idx_applications_deadline on public.applications(deadline);
create index if not exists idx_applications_company_id on public.applications(company_id);
create index if not exists idx_applications_updated_at on public.applications(updated_at desc);
create index if not exists idx_applications_user_status on public.applications(user_id, status);

-- simple trigram-free search helper index over commonly searched text columns
create index if not exists idx_applications_job_title on public.applications using gin (to_tsvector('english', coalesce(job_title,'')));

-- companies
create index if not exists idx_companies_user_id on public.companies(user_id);
create index if not exists idx_companies_name on public.companies(name);

-- interviews
create index if not exists idx_interviews_user_id on public.interviews(user_id);
create index if not exists idx_interviews_application_id on public.interviews(application_id);
create index if not exists idx_interviews_scheduled_at on public.interviews(scheduled_at);

-- contacts
create index if not exists idx_contacts_user_id on public.contacts(user_id);
create index if not exists idx_contacts_company_id on public.contacts(company_id);

-- notes
create index if not exists idx_notes_application_id on public.notes(application_id);
create index if not exists idx_notes_user_id on public.notes(user_id);

-- reminders
create index if not exists idx_reminders_user_id on public.reminders(user_id);
create index if not exists idx_reminders_remind_at on public.reminders(remind_at);
create index if not exists idx_reminders_completed on public.reminders(completed);

-- application_activity
create index if not exists idx_activity_application_id on public.application_activity(application_id);
create index if not exists idx_activity_user_id on public.application_activity(user_id);
create index if not exists idx_activity_created_at on public.application_activity(created_at desc);
