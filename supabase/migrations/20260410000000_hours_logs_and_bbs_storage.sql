-- OCR / upload audit: one row per extracted date line from BBS-style logs.
-- Private Storage bucket for source files.

create table public.hours_logs (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  supervisee_id uuid not null references public.profiles (id) on delete cascade,
  work_date date not null,
  site_name text,
  individual_supervision_hours numeric(8, 2) not null default 0 check (individual_supervision_hours >= 0),
  group_supervision_hours numeric(8, 2) not null default 0 check (group_supervision_hours >= 0),
  clinical_hours numeric(8, 2) not null default 0 check (clinical_hours >= 0),
  source_storage_path text,
  ocr_raw jsonb,
  created_at timestamptz not null default now ()
);

create index hours_logs_supervisee_date_idx on public.hours_logs (supervisee_id, work_date);

alter table public.hours_logs enable row level security;

create policy hours_logs_select_self on public.hours_logs
  for select using (supervisee_id = auth.uid ());

create policy hours_logs_insert_self on public.hours_logs
  for insert with check (
    supervisee_id = auth.uid ()
    and organization_id = (select (public.current_profile ()).organization_id)
  );

create policy hours_logs_delete_self on public.hours_logs
  for delete using (supervisee_id = auth.uid ());

comment on table public.hours_logs is
  'Per-day lines extracted from uploaded BBS-style logs (OCR). Separate from weekly_hour_entries grid.';

-- Storage: private bucket for BBS uploads (first path segment = auth user id)

insert into storage.buckets (id, name, public)
values ('bbs-documents', 'bbs-documents', false)
on conflict (id) do nothing;

create policy bbs_documents_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bbs-documents'
    and split_part (name, '/', 1) = auth.uid ()::text
  );

create policy bbs_documents_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'bbs-documents'
    and split_part (name, '/', 1) = auth.uid ()::text
  );

create policy bbs_documents_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'bbs-documents'
    and split_part (name, '/', 1) = auth.uid ()::text
  )
  with check (
    bucket_id = 'bbs-documents'
    and split_part (name, '/', 1) = auth.uid ()::text
  );

create policy bbs_documents_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bbs-documents'
    and split_part (name, '/', 1) = auth.uid ()::text
  );

notify pgrst, 'reload schema';
