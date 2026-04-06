-- Fingerprint uploaded documents to detect re-uploads of the same file.

alter table public.hours_logs
  add column if not exists source_content_hash text;

create index if not exists hours_logs_supervisee_content_hash_idx
  on public.hours_logs (supervisee_id, source_content_hash)
  where source_content_hash is not null;

comment on column public.hours_logs.source_content_hash is
  'SHA-256 (hex) of uploaded file bytes; used to warn on duplicate document uploads.';

notify pgrst, 'reload schema';
