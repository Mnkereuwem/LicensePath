-- Credential track: tailors AI documentation prompts (scan + PDF) to each board’s typical logs.

alter table public.profiles
  add column if not exists license_track text;

comment on column public.profiles.license_track is
  'One of: ca_asw, ca_lmft, ca_lpcc, ny_lmhc, ny_lcsw, tx_lpc. NULL treated as ca_asw in the app.';

notify pgrst, 'reload schema';
