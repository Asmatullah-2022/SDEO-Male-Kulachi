-- =====================================================================
-- SDEO (Male) Kulachi — Daily Enrollment Monitoring System
-- Supabase / PostgreSQL Schema
-- =====================================================================
-- Run this file in the Supabase SQL Editor (Project > SQL Editor > New query)
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('headteacher', 'admin');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'school_status') then
    create type school_status as enum ('active', 'inactive');
  end if;
end$$;

-- ---------------------------------------------------------------------
-- TABLE: schools
-- ---------------------------------------------------------------------
create table if not exists public.schools (
  id            uuid primary key default gen_random_uuid(),
  school_name   text not null,
  emis_code     text not null unique,
  district      text not null default 'Dera Ismail Khan',
  tehsil        text not null default 'Kulachi',
  circle        text,
  status        school_status not null default 'active',
  created_at    timestamptz not null default now()
);

comment on table public.schools is 'Government primary schools under SDEO (Male) Kulachi';

-- ---------------------------------------------------------------------
-- TABLE: profiles (extends auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  full_name      text not null,
  mobile_number  text,
  designation    text not null default 'Headteacher/Incharge',
  school_id      uuid references public.schools(id) on delete set null,
  role           user_role not null default 'headteacher',
  created_at     timestamptz not null default now()
);

comment on table public.profiles is 'Application users: Headteachers and SDEO Admin office staff';

-- One headteacher account per school (an admin has school_id = null)
create unique index if not exists profiles_school_id_headteacher_unique
  on public.profiles (school_id)
  where role = 'headteacher' and school_id is not null;

-- ---------------------------------------------------------------------
-- TABLE: daily_enrollment
-- ---------------------------------------------------------------------
create table if not exists public.daily_enrollment (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  report_date       date not null default current_date,
  dropout           integer not null default 0 check (dropout >= 0),
  public_admission  integer not null default 0 check (public_admission >= 0),
  private_admission integer not null default 0 check (private_admission >= 0),
  fresh_admission   integer not null default 0 check (fresh_admission >= 0),
  total_enrollment  integer not null default 0 check (total_enrollment >= 0),
  submitted_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Prevents duplicate reports for the same school on the same day
  constraint daily_enrollment_school_date_unique unique (school_id, report_date)
);

comment on table public.daily_enrollment is 'Daily enrollment figures submitted by each school headteacher';

create index if not exists daily_enrollment_report_date_idx on public.daily_enrollment (report_date);
create index if not exists daily_enrollment_school_id_idx on public.daily_enrollment (school_id);

-- ---------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists daily_enrollment_set_updated_at on public.daily_enrollment;
create trigger daily_enrollment_set_updated_at
  before update on public.daily_enrollment
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Helper function: is the current user an admin?
-- (SECURITY DEFINER avoids recursive RLS lookups on profiles)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.current_school_id()
returns uuid as $$
  select school_id from public.profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.daily_enrollment enable row level security;

-- schools policies
drop policy if exists "schools_select_all_authenticated" on public.schools;
create policy "schools_select_all_authenticated"
  on public.schools for select
  to authenticated
  using (true);

drop policy if exists "schools_admin_insert" on public.schools;
create policy "schools_admin_insert"
  on public.schools for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "schools_admin_update" on public.schools;
create policy "schools_admin_update"
  on public.schools for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "schools_admin_delete" on public.schools;
create policy "schools_admin_delete"
  on public.schools for delete
  to authenticated
  using (public.is_admin());

-- profiles policies
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert"
  on public.profiles for insert
  to authenticated
  with check (public.is_admin() or id = auth.uid());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
  on public.profiles for update
  to authenticated
  using (public.is_admin() or id = auth.uid())
  with check (
    public.is_admin()
    or (id = auth.uid() and role = (select role from public.profiles where id = auth.uid())
        and school_id is not distinct from (select school_id from public.profiles where id = auth.uid()))
  );

drop policy if exists "profiles_admin_delete" on public.profiles;
create policy "profiles_admin_delete"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- daily_enrollment policies
drop policy if exists "enrollment_select_own_school_or_admin" on public.daily_enrollment;
create policy "enrollment_select_own_school_or_admin"
  on public.daily_enrollment for select
  to authenticated
  using (school_id = public.current_school_id() or public.is_admin());

drop policy if exists "enrollment_insert_own_school" on public.daily_enrollment;
create policy "enrollment_insert_own_school"
  on public.daily_enrollment for insert
  to authenticated
  with check (
    (school_id = public.current_school_id() and user_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "enrollment_update_own_school_or_admin" on public.daily_enrollment;
create policy "enrollment_update_own_school_or_admin"
  on public.daily_enrollment for update
  to authenticated
  using (school_id = public.current_school_id() or public.is_admin())
  with check (school_id = public.current_school_id() or public.is_admin());

drop policy if exists "enrollment_delete_admin_only" on public.daily_enrollment;
create policy "enrollment_delete_admin_only"
  on public.daily_enrollment for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user signs up
-- (Admin normally creates headteacher accounts via Supabase Auth Admin API
--  / dashboard, then this trigger seeds a matching profile row.)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'headteacher')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Seed: first admin (optional — edit email after creating the auth user)
-- ---------------------------------------------------------------------
-- update public.profiles set role = 'admin', school_id = null
-- where id = (select id from auth.users where email = 'sdeo.kulachi@example.com');
