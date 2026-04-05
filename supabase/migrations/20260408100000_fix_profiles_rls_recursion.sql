-- Policies that subquery public.profiles while evaluating RLS on profiles
-- cause “infinite recursion detected in policy for relation profiles”.
-- Use security definer public.current_profile() instead (bypasses RLS for the lookup).

drop policy if exists organizations_select_member on public.organizations;

create policy organizations_select_member on public.organizations
  for select using (
    id = (select (public.current_profile ()).organization_id)
  );

drop policy if exists supervision_relationships_select on public.supervision_relationships;

create policy supervision_relationships_select on public.supervision_relationships
  for select using (
    organization_id = (select (public.current_profile ()).organization_id)
  );

drop policy if exists profiles_select_org on public.profiles;

create policy profiles_select_org on public.profiles
  for select using (
    organization_id = (select (public.current_profile ()).organization_id)
  );

drop policy if exists weekly_entries_insert_self on public.weekly_hour_entries;

create policy weekly_entries_insert_self on public.weekly_hour_entries
  for insert with check (
    supervisee_id = auth.uid ()
    and organization_id = (select (public.current_profile ()).organization_id)
  );

drop policy if exists weekly_entries_update_self on public.weekly_hour_entries;

create policy weekly_entries_update_self on public.weekly_hour_entries
  for update using (supervisee_id = auth.uid ()) with check (
    supervisee_id = auth.uid ()
    and organization_id = (select (public.current_profile ()).organization_id)
  );

notify pgrst, 'reload schema';
