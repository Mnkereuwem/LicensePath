-- LicensePath initial schema: multi-tenant ASW hour tracking with RLS-ready tables.
-- Map aggregates to official BBS Form 1800 at export time (PDF field names differ by revision).

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
create type public.user_role as enum ('supervisee', 'supervisor', 'org_admin', 'compliance_auditor');
create type public.time_entry_category as enum (
  'direct_clinical',
  'face_to_face',
  'non_clinical',
  'individual_supervision',
  'group_supervision',
  'other'
);

-- Tenants
create table public.organizations (
  id uuid primary key default gen_random_uuid (),
  name text not null,
  created_at timestamptz not null default now ()
);

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  full_name text,
  role public.user_role not null default 'supervisee',
  created_at timestamptz not null default now ()
);

create index profiles_organization_id_idx on public.profiles (organization_id);

-- ASW registration clock (6-year sunset from BBS registration)
create table public.supervisee_license_clocks (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  bbs_registration_at date not null,
  notes text,
  updated_at timestamptz not null default now ()
);

-- Supervisor ↔ supervisee (same org)
create table public.supervision_relationships (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  supervisee_id uuid not null references public.profiles (id) on delete cascade,
  supervisor_id uuid not null references public.profiles (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now (),
  constraint supervision_different_people check (supervisee_id <> supervisor_id)
);

create index supervision_supervisee_idx on public.supervision_relationships (supervisee_id);
create index supervision_supervisor_idx on public.supervision_relationships (supervisor_id);

-- Client identifiers — no PHI in v1; access is grant-gated for future clinical notes
create table public.client_records (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  external_ref text,
  created_at timestamptz not null default now ()
);

create table public.client_access_grants (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  client_record_id uuid not null references public.client_records (id) on delete cascade,
  grantee_profile_id uuid not null references public.profiles (id) on delete cascade,
  granted_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now (),
  unique (client_record_id, grantee_profile_id)
);

-- Weekly buckets for creditable hours (app enforces 40h cap & supervision ratio pre-credit)
-- bbs_form_1800_line / service_code: align with current BBS PDF at export time
create table public.weekly_hour_entries (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  supervisee_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  category public.time_entry_category not null,
  hours numeric(6, 2) not null check (hours >= 0),
  credited_hours numeric(6, 2) not null check (credited_hours >= 0 and credited_hours <= hours),
  bbs_form_1800_field_key text,
  aswb_alignment_note text,
  client_record_id uuid references public.client_records (id) on delete set null,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now ()
);

create index weekly_hour_entries_supervisee_week_idx
  on public.weekly_hour_entries (supervisee_id, week_start);

-- Audit / export queue
create table public.audit_exports (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  supervisee_id uuid not null references public.profiles (id) on delete restrict,
  form_type text not null default 'bbs_1800',
  payload jsonb,
  created_at timestamptz not null default now ()
);

-- Row Level Security
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.supervisee_license_clocks enable row level security;
alter table public.supervision_relationships enable row level security;
alter table public.client_records enable row level security;
alter table public.client_access_grants enable row level security;
alter table public.weekly_hour_entries enable row level security;
alter table public.audit_exports enable row level security;

-- Helper: current user's org
create or replace function public.current_profile ()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.profiles p
  where p.id = auth.uid ();
$$;

-- Organizations: members can read their tenant row
create policy organizations_select_member on public.organizations
  for select using (
    id = (select organization_id from public.profiles where id = auth.uid ())
  );

-- Supervision relationships: visible within same organization
create policy supervision_relationships_select on public.supervision_relationships
  for select using (
    organization_id = (select organization_id from public.profiles where id = auth.uid ())
  );

-- Audit exports: requester or subject supervisee
create policy audit_exports_select on public.audit_exports
  for select using (
    requested_by = auth.uid () or supervisee_id = auth.uid ()
  );

-- Profiles: users can read profiles in their organization (tighten per role later)
create policy profiles_select_org on public.profiles
  for select using (
    organization_id = (select organization_id from public.profiles where id = auth.uid ())
  );

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid ());

-- Supervisee clocks: owner or supervisors in relationship / org admin (simplified: same org + self)
create policy supervisee_clocks_select on public.supervisee_license_clocks
  for select using (
    profile_id = auth.uid ()
    or exists (
      select 1 from public.supervision_relationships r
      where r.supervisor_id = auth.uid ()
        and r.supervisee_id = profile_id
        and r.active = true
    )
  );

create policy supervisee_clocks_mutate_self on public.supervisee_license_clocks
  for all using (profile_id = auth.uid ());

-- Weekly entries: supervisee owns rows; supervisors see linked supervisees
create policy weekly_entries_select on public.weekly_hour_entries
  for select using (
    supervisee_id = auth.uid ()
    or exists (
      select 1 from public.supervision_relationships r
      where r.supervisor_id = auth.uid ()
        and r.supervisee_id = weekly_hour_entries.supervisee_id
        and r.active = true
    )
  );

create policy weekly_entries_insert_self on public.weekly_hour_entries
  for insert with check (supervisee_id = auth.uid ());

create policy weekly_entries_update_self on public.weekly_hour_entries
  for update using (supervisee_id = auth.uid ());

create policy weekly_entries_delete_self on public.weekly_hour_entries
  for delete using (supervisee_id = auth.uid ());

-- Client records: deny-by-default; only grantees + same-org admins (expand with org_admin check)
create policy client_records_select on public.client_records
  for select using (
    exists (
      select 1 from public.client_access_grants g
      where g.client_record_id = client_records.id
        and g.grantee_profile_id = auth.uid ()
    )
  );

create policy client_grants_select on public.client_access_grants
  for select using (grantee_profile_id = auth.uid ());

-- Note: add INSERT policies for client records/grants when workflows are implemented.

comment on table public.weekly_hour_entries is
  'Creditable hours by week; application enforces 40h/week cap and supervision ratio before credited_hours.';

comment on column public.weekly_hour_entries.bbs_form_1800_field_key is
  'Stable internal key mapped to official BBS Form 1800 PDF fields at export time.';
