create table if not exists public.app_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now()
);

revoke all on public.app_members from public, anon, authenticated;
grant all on public.app_members to service_role;
alter table public.app_members enable row level security;

do $$
declare
  n integer;
  uid uuid;
begin
  select count(*) into n from auth.users;
  if n <> 1 then
    raise exception 'Expected exactly one auth user, found %', n;
  end if;
  select id into uid from auth.users limit 1;
  insert into public.app_members (user_id, role)
  values (uid, 'owner')
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.is_app_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_members m where m.user_id = auth.uid()
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
alter table public.botanical_content enable row level security;
create policy "Members read botanical content"
  on public.botanical_content for select to authenticated
  using (public.is_app_member());

drop policy if exists "Anyone can read trend content" on public.trend_content;
drop policy if exists "Anyone can insert trend content" on public.trend_content;
drop policy if exists "Anyone can update trend content" on public.trend_content;
drop policy if exists "Anyone can delete trend content" on public.trend_content;
drop policy if exists "Members read trend content" on public.trend_content;
revoke all on public.trend_content from public, anon, authenticated;
grant select on public.trend_content to authenticated;
grant all on public.trend_content to service_role;
alter table public.trend_content enable row level security;
create policy "Members read trend content"
  on public.trend_content for select to authenticated
  using (public.is_app_member());

drop policy if exists "Anyone can read animated" on public.botanical_animated;
drop policy if exists "Anyone can insert animated" on public.botanical_animated;
drop policy if exists "Anyone can update animated" on public.botanical_animated;
drop policy if exists "Anyone can delete animated" on public.botanical_animated;
drop policy if exists "Members read animation runs" on public.botanical_animated;
revoke all on public.botanical_animated from public, anon, authenticated;
grant select on public.botanical_animated to authenticated;
grant all on public.botanical_animated to service_role;
alter table public.botanical_animated enable row level security;
create policy "Members read animation runs"
  on public.botanical_animated for select to authenticated
  using (public.is_app_member());

drop policy if exists "Anyone can read provider jobs" on public.animation_provider_jobs;
drop policy if exists "Members read provider jobs" on public.animation_provider_jobs;
revoke all on public.animation_provider_jobs from public, anon, authenticated;
grant select on public.animation_provider_jobs to authenticated;
grant all on public.animation_provider_jobs to service_role;
alter table public.animation_provider_jobs enable row level security;
create policy "Members read provider jobs"
  on public.animation_provider_jobs for select to authenticated
  using (public.is_app_member());