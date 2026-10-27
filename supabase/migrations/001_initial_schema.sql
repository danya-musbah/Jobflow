-- ============================================================
-- JOBFLOW - 001_initial_schema.sql
-- Core tables for the JobFlow application.
-- Run this in the Supabase SQL Editor (or via `supabase db push`).
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- profiles
-- One row per auth.users row. Created automatically by trigger
-- in 004_triggers.sql (handle_new_user).
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  timezone text default 'UTC',
  default_view text default 'table',        -- 'table' | 'kanban'
  default_sort text default 'updated_at_desc',
  items_per_page integer default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per authenticated user; extends auth.users.';

-- ------------------------------------------------------------
-- companies
-- ------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  website text,
  industry text,
  location text,
  company_size text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- applications
-- ------------------------------------------------------------
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  job_title text not null,
  job_url text,
  location text,
  employment_type text check (employment_type in
    ('FULL_TIME','PART_TIME','INTERNSHIP','CONTRACT','FREELANCE','TEMPORARY')),
  work_mode text check (work_mode in ('REMOTE','HYBRID','ONSITE')),
  salary_min numeric,
  salary_max numeric,
  currency text default 'USD',
  status text not null default 'SAVED' check (status in
    ('SAVED','APPLIED','SCREENING','INTERVIEW','TECHNICAL_INTERVIEW',
     'OFFER','ACCEPTED','REJECTED','WITHDRAWN')),
  priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH')),
  source text check (source in
    ('LinkedIn','Indeed','Company Website','Glassdoor','Referral',
     'University','Recruiter','Job Board','Other')),
  applied_at date,
  deadline date,
  description text,
  contact_name text,
  contact_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- interviews
-- ------------------------------------------------------------
create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in
    ('HR_SCREENING','RECRUITER_CALL','TECHNICAL_INTERVIEW','CODING_INTERVIEW',
     'BEHAVIORAL_INTERVIEW','SYSTEM_DESIGN','HIRING_MANAGER','FINAL_INTERVIEW','OTHER')),
  scheduled_at timestamptz not null,
  duration_minutes integer default 60,
  location text,
  interviewer text,
  notes text,
  result text check (result in ('PENDING','PASSED','FAILED','CANCELLED','RESCHEDULED')) default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- contacts
-- ------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  position text,
  email text,
  phone text,
  linkedin_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- notes
-- ------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- reminders
-- ------------------------------------------------------------
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  title text not null,
  description text,
  remind_at timestamptz not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- application_activity (append-only timeline)
-- ------------------------------------------------------------
create table if not exists public.application_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  activity_type text not null check (activity_type in
    ('APPLICATION_CREATED','STATUS_CHANGED','APPLICATION_UPDATED','APPLICATION_DELETED',
     'INTERVIEW_CREATED','INTERVIEW_UPDATED','NOTE_ADDED','REMINDER_CREATED','REMINDER_COMPLETED')),
  description text not null,
  created_at timestamptz not null default now()
);
