-- ============================================================
-- JOBFLOW - 004_triggers.sql
-- 1) auto-maintain updated_at on every table that has it
-- 2) auto-create a profiles row when a new auth.users row appears
-- 3) auto-log application_activity on status changes
-- ============================================================

-- ------------------------------------------------------------
-- 1. updated_at maintenance
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

create trigger trg_applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

create trigger trg_interviews_updated_at before update on public.interviews
  for each row execute function public.set_updated_at();

create trigger trg_contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

create trigger trg_notes_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

create trigger trg_reminders_updated_at before update on public.reminders
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. auto-create profile on signup
-- SECURITY DEFINER is required here because this runs from an
-- auth.users trigger, outside the normal authenticated context.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 3. auto-log a STATUS_CHANGED activity row when an application's
--    status column changes. Other activity types (APPLICATION_CREATED,
--    NOTE_ADDED, etc.) are written explicitly by the frontend/api.js
--    at the moment of the corresponding user action, since they need
--    human-readable context the database doesn't have.
-- ------------------------------------------------------------
create or replace function public.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.application_activity (user_id, application_id, activity_type, description)
    values (
      new.user_id,
      new.id,
      'STATUS_CHANGED',
      'Status changed from ' || old.status || ' to ' || new.status
    );
  end if;
  return new;
end;
$$;

create trigger trg_applications_status_change
  after update on public.applications
  for each row execute function public.log_status_change();
