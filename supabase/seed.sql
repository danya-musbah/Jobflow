-- ============================================================
-- JOBFLOW - seed.sql
--
-- This file does NOT create a fake user directly (you cannot
-- safely insert into auth.users from plain SQL — passwords must
-- go through Supabase Auth). Instead:
--
--   1. Create a real demo account through Supabase Auth
--      (sign up normally via the app, or via the Auth admin API/
--      dashboard) e.g. demo@jobflow.app.
--   2. Copy that user's id from the auth.users table.
--   3. Paste it below in place of :demo_user_id and run this
--      script in the SQL Editor.
--
-- This keeps demo data owned by a real, RLS-protected account
-- instead of a synthetic row that would break auth.uid() checks.
-- ============================================================

-- Replace this with the real UUID of your demo user before running.
-- select id from auth.users where email = 'demo@jobflow.app';
\set demo_user_id 'REPLACE-WITH-DEMO-USER-UUID'

do $$
declare
  v_user uuid := :'demo_user_id';
  c_google uuid := gen_random_uuid();
  c_stripe uuid := gen_random_uuid();
  c_airbnb uuid := gen_random_uuid();
  c_notion uuid := gen_random_uuid();
  c_figma  uuid := gen_random_uuid();
  a1 uuid; a2 uuid; a3 uuid; a4 uuid; a5 uuid; a6 uuid;
begin
  if v_user = 'REPLACE-WITH-DEMO-USER-UUID' then
    raise exception 'Set :demo_user_id to a real auth.users.id before running seed.sql';
  end if;

  insert into public.companies (id, user_id, name, website, industry, location, company_size)
  values
    (c_google, v_user, 'Google', 'https://google.com', 'Technology', 'Mountain View, CA', '10000+'),
    (c_stripe, v_user, 'Stripe', 'https://stripe.com', 'Fintech', 'San Francisco, CA', '1000-5000'),
    (c_airbnb, v_user, 'Airbnb', 'https://airbnb.com', 'Travel & Hospitality', 'San Francisco, CA', '5000-10000'),
    (c_notion, v_user, 'Notion', 'https://notion.so', 'Productivity Software', 'San Francisco, CA', '500-1000'),
    (c_figma,  v_user, 'Figma', 'https://figma.com', 'Design Software', 'San Francisco, CA', '500-1000');

  insert into public.applications
    (id, user_id, company_id, job_title, job_url, location, employment_type, work_mode,
     salary_min, salary_max, currency, status, priority, source, applied_at, deadline, description)
  values
    (gen_random_uuid(), v_user, c_google, 'Frontend Engineer', 'https://careers.google.com/1', 'Mountain View, CA', 'FULL_TIME', 'HYBRID', 140000, 190000, 'USD', 'INTERVIEW', 'HIGH', 'LinkedIn', current_date - 21, current_date + 10, 'Building UI for internal tools.'),
    (gen_random_uuid(), v_user, c_stripe, 'Backend Engineer', 'https://stripe.com/jobs/2', 'Remote', 'FULL_TIME', 'REMOTE', 150000, 200000, 'USD', 'SCREENING', 'HIGH', 'Referral', current_date - 14, null, 'Payments infrastructure team.'),
    (gen_random_uuid(), v_user, c_airbnb, 'Product Designer', 'https://careers.airbnb.com/3', 'San Francisco, CA', 'FULL_TIME', 'ONSITE', 130000, 170000, 'USD', 'APPLIED', 'MEDIUM', 'Company Website', current_date - 7, current_date + 20, 'Design for host experience.'),
    (gen_random_uuid(), v_user, c_notion, 'Full Stack Engineer', 'https://notion.so/careers/4', 'Remote', 'FULL_TIME', 'REMOTE', 145000, 185000, 'USD', 'OFFER', 'HIGH', 'Recruiter', current_date - 30, null, 'Docs and collaboration features.'),
    (gen_random_uuid(), v_user, c_figma, 'UX Researcher', 'https://figma.com/careers/5', 'Remote', 'CONTRACT', 'REMOTE', 90, 120, 'USD', 'SAVED', 'LOW', 'Indeed', null, current_date + 30, 'Contract research role, hourly rate.'),
    (gen_random_uuid(), v_user, c_google, 'Site Reliability Engineer', 'https://careers.google.com/6', 'Remote', 'FULL_TIME', 'REMOTE', 150000, 210000, 'USD', 'REJECTED', 'MEDIUM', 'Job Board', current_date - 45, null, 'On-call rotation for core infra.')
  returning id into a1;

  -- Log a couple of activities/notes/reminders against the most recent application for demo purposes
  select id into a1 from public.applications where user_id = v_user order by created_at desc limit 1;

  insert into public.application_activity (user_id, application_id, activity_type, description)
  values (v_user, a1, 'APPLICATION_CREATED', 'Application created from seed data');

  insert into public.notes (user_id, application_id, content)
  values (v_user, a1, 'Recruiter mentioned the team is expanding into ML infra.');

  insert into public.reminders (user_id, application_id, title, description, remind_at, completed)
  values (v_user, a1, 'Send thank-you email', 'Follow up after the phone screen', now() + interval '2 days', false);

end $$;
