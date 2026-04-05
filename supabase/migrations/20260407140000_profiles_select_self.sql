-- Allow each user to read their own profile row without relying only on org subqueries
-- (helps when debugging RLS and avoids edge cases with empty org lookups).

drop policy if exists profiles_select_self on public.profiles;

create policy profiles_select_self on public.profiles
  for select using (id = auth.uid ());
