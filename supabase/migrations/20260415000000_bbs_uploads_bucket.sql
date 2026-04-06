-- Mobile / camera scans: private bucket separate from PDF bbs-documents

insert into storage.buckets (id, name, public)
values ('bbs-uploads', 'bbs-uploads', false)
on conflict (id) do nothing;

create policy bbs_uploads_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bbs-uploads'
    and split_part (name, '/', 1) = auth.uid ()::text
  );

create policy bbs_uploads_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'bbs-uploads'
    and split_part (name, '/', 1) = auth.uid ()::text
  );

create policy bbs_uploads_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'bbs-uploads'
    and split_part (name, '/', 1) = auth.uid ()::text
  )
  with check (
    bucket_id = 'bbs-uploads'
    and split_part (name, '/', 1) = auth.uid ()::text
  );

create policy bbs_uploads_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bbs-uploads'
    and split_part (name, '/', 1) = auth.uid ()::text
  );

comment on column storage.buckets.name is
  'bbs-uploads: camera captures from LicensePath mobile shell → server-side vision OCR.';

notify pgrst, 'reload schema';
