-- ============================================================
-- JOBFLOW - 002_rls_policies.sql
-- Row Level Security: every user-owned table is locked down so
-- a user can only ever see/modify their own rows.
-- ============================================================

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.applications enable row level security;
alter table public.interviews enable row level security;
alter table public.contacts enable row level security;
alter table public.notes enable row level security;
alter table public.reminders enable row level security;
alter table public.application_activity enable row level security;

-- ------------------------------------------------------------
-- profiles: a user may only see/edit their own profile row
-- ------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- profiles are deleted automatically via ON DELETE CASCADE from auth.users

-- ------------------------------------------------------------
-- companies
-- ------------------------------------------------------------
create policy "companies_select_own" on public.companies
  for select using (auth.uid() = user_id);

create policy "companies_insert_own" on public.companies
  for insert with check (auth.uid() = user_id);

create policy "companies_update_own" on public.companies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "companies_delete_own" on public.companies
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- applications
-- ------------------------------------------------------------
create policy "applications_select_own" on public.applications
  for select using (auth.uid() = user_id);

create policy "applications_insert_own" on public.applications
  for insert with check (
    auth.uid() = user_id
    and (
      company_id is null
      or exists (select 1 from public.companies c where c.id = company_id and c.user_id = auth.uid())
    )
  );

create policy "applications_update_own" on public.applications
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and (
      company_id is null
      or exists (select 1 from public.companies c where c.id = company_id and c.user_id = auth.uid())
    )
  );

create policy "applications_delete_own" on public.applications
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- interviews (parent application must belong to the user)
-- ------------------------------------------------------------
create policy "interviews_select_own" on public.interviews
  for select using (auth.uid() = user_id);

create policy "interviews_insert_own" on public.interviews
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.applications a where a.id = application_id and a.user_id = auth.uid())
  );

create policy "interviews_update_own" on public.interviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "interviews_delete_own" on public.interviews
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- contacts
-- ------------------------------------------------------------
create policy "contacts_select_own" on public.contacts
  for select using (auth.uid() = user_id);

create policy "contacts_insert_own" on public.contacts
  for insert with check (auth.uid() = user_id);

create policy "contacts_update_own" on public.contacts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "contacts_delete_own" on public.contacts
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- notes (parent application must belong to the user)
-- ------------------------------------------------------------
create policy "notes_select_own" on public.notes
  for select using (auth.uid() = user_id);

create policy "notes_insert_own" on public.notes
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.applications a where a.id = application_id and a.user_id = auth.uid())
  );

create policy "notes_update_own" on public.notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notes_delete_own" on public.notes
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- reminders
-- ------------------------------------------------------------
create policy "reminders_select_own" on public.reminders
  for select using (auth.uid() = user_id);

create policy "reminders_insert_own" on public.reminders
  for insert with check (auth.uid() = user_id);

create policy "reminders_update_own" on public.reminders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "reminders_delete_own" on public.reminders
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- application_activity (append-only: select + insert only)
-- ------------------------------------------------------------
create policy "activity_select_own" on public.application_activity
  for select using (auth.uid() = user_id);

create policy "activity_insert_own" on public.application_activity
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.applications a where a.id = application_id and a.user_id = auth.uid())
  );

-- No update/delete policies for application_activity => it is immutable
-- for normal (anon-key) clients, which is the desired audit-log behaviour.
