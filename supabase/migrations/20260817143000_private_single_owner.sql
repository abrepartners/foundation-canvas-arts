-- Convert the live application from a browser-visible passcode to one real
-- Supabase Auth owner. The project currently has exactly one auth user.

create table if not exists public.app_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role = 'owner'),
  created_at timestamptz not null default now()
);

do $$
declare
  existing_users integer;
begin
  select count(*) into existing_users from auth.users;
  if existing_users <> 1 then
    raise exception 'Expected exactly one existing auth user, found %', existing_users;
  end if;

  insert into public.app_members (user_id, role)
  select id, 'owner' from auth.users
  on conflict (user_id) do update set role = excluded.role;
end
$$;

alter table public.app_members enable row level security;
revoke all on public.app_members from public, anon, authenticated;
grant all on public.app_members to service_role;

create or replace function public.is_app_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_members where user_id = auth.uid()
  );
$$;

revoke execute on function public.is_app_member() from public, anon;
grant execute on function public.is_app_member() to authenticated, service_role;

drop policy if exists "Anyone can read content" on public.botanical_content;
drop policy if exists "Anyone can insert content" on public.botanical_content;
drop policy if exists "Anyone can update content" on public.botanical_content;
drop policy if exists "Anyone can delete content" on public.botanical_content;
drop policy if exists "Members read botanical content" on public.botanical_content;
revoke all on public.botanical_content from public, anon, authenticated;
grant select on public.botanical_content to authenticated;
grant all on public.botanical_content to service_role;
create policy "Members read botanical content"
  on public.botanical_content for select to authenticated
  using (public.is_app_member());

drop policy if exists "Anyone can read animated" on public.botanical_animated;
drop policy if exists "Anyone can insert animated" on public.botanical_animated;
drop policy if exists "Anyone can update animated" on public.botanical_animated;
drop policy if exists "Anyone can delete animated" on public.botanical_animated;
drop policy if exists "Members read animation runs" on public.botanical_animated;
revoke all on public.botanical_animated from public, anon, authenticated;
grant select on public.botanical_animated to authenticated;
grant all on public.botanical_animated to service_role;
create policy "Members read animation runs"
  on public.botanical_animated for select to authenticated
  using (public.is_app_member());

drop policy if exists "Anyone can read trend content" on public.trend_content;
drop policy if exists "Anyone can insert trend content" on public.trend_content;
drop policy if exists "Anyone can delete trend content" on public.trend_content;
drop policy if exists "Members read trend content" on public.trend_content;
revoke all on public.trend_content from public, anon, authenticated;
grant select on public.trend_content to authenticated;
grant all on public.trend_content to service_role;
create policy "Members read trend content"
  on public.trend_content for select to authenticated
  using (public.is_app_member());
