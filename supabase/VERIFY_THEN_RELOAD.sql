-- Run in Supabase → SQL Editor (same project as .env.local NEXT_PUBLIC_SUPABASE_URL).
-- 1) Confirms Postgres really has the tables
-- 2) Tells PostgREST to refresh (fixes many PGRST205 cases)

select
  c.relname as table_name,
  'ok' as status
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'organizations',
    'profiles',
    'supervisee_license_clocks',
    'weekly_hour_entries',
    'hours_logs'
  )
order by 1;

-- If any table in the list is missing on THIS project, create it (see repo SQL migrations).
-- Run the full script: supabase/RUN_IN_SUPABASE_SQL_EDITOR.sql (entire file, then Run).

-- If you get all 4 rows but the app still says PGRST205:
-- • Dashboard → Project Settings → Data API → “Exposed schemas” must include: public
-- • Dashboard → Project Settings → Data API → “Enable Data API” must be ON

notify pgrst, 'reload schema';
