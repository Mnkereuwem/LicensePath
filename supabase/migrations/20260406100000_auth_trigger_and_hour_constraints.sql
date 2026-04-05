-- Default tenant for solo supervisees (replace with real org model when you onboard agencies)
insert into public.organizations (id, name)
values (
    'a0000000-0000-4000-8000-000000000001',
    'License FYI default'
  )
on conflict (id) do nothing;

-- One row per category per week per supervisee (for upserts from the app)
create unique index if not exists weekly_hour_entries_supervisee_week_category_key
  on public.weekly_hour_entries (supervisee_id, week_start, category);

-- Auto-create profile + sunset clock on signup
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_org uuid := 'a0000000-0000-4000-8000-000000000001';
  reg date;
begin
  insert into public.profiles (id, organization_id, full_name, role)
  values (
    new.id,
    default_org,
    coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
      split_part(new.email, '@', 1)
    ),
    'supervisee'
  );

  reg := coalesce(
    (nullif(new.raw_user_meta_data ->> 'bbs_registration_at', ''))::date,
    (current_timestamp at time zone 'utc')::date
  );

  insert into public.supervisee_license_clocks (profile_id, bbs_registration_at)
  values (new.id, reg);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users for each row
execute procedure public.handle_new_user ();

-- Tighten RLS: weekly rows must belong to the writer’s organization
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

-- Supervisee clocks: explicit insert/update checks (FOR ALL was ambiguous for INSERT)
drop policy if exists supervisee_clocks_mutate_self on public.supervisee_license_clocks;

create policy supervisee_clocks_insert_self on public.supervisee_license_clocks
  for insert with check (profile_id = auth.uid ());

create policy supervisee_clocks_update_self on public.supervisee_license_clocks
  for update using (profile_id = auth.uid ()) with check (profile_id = auth.uid ());
