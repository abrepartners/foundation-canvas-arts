-- Owned Supabase baseline hardening and cross-platform publishing/measurement.
-- The application is single-operator: only explicit app_members can read data;
-- every write and every provider token remains service-role-only.

create table if not exists public.app_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now()
);

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
    select 1 from public.app_members m where m.user_id = auth.uid()
  );
$$;

revoke execute on function public.is_app_member() from public, anon;
grant execute on function public.is_app_member() to authenticated, service_role;

-- Remove every legacy anonymous read/write path. Browser reads are allowed
-- only for an authenticated member. All mutations continue through guarded
-- Edge Functions using the service role.
drop policy if exists "Anyone can read content" on public.botanical_content;
drop policy if exists "Anyone can insert content" on public.botanical_content;
drop policy if exists "Anyone can update content" on public.botanical_content;
drop policy if exists "Anyone can delete content" on public.botanical_content;
revoke all on public.botanical_content from public, anon, authenticated;
grant select on public.botanical_content to authenticated;
grant all on public.botanical_content to service_role;
create policy "Members read botanical content"
  on public.botanical_content for select to authenticated
  using (public.is_app_member());

drop policy if exists "Anyone can read trend content" on public.trend_content;
drop policy if exists "Anyone can insert trend content" on public.trend_content;
drop policy if exists "Anyone can delete trend content" on public.trend_content;
revoke all on public.trend_content from public, anon, authenticated;
grant select on public.trend_content to authenticated;
grant all on public.trend_content to service_role;
create policy "Members read trend content"
  on public.trend_content for select to authenticated
  using (public.is_app_member());

drop policy if exists "Anyone can read animated" on public.botanical_animated;
drop policy if exists "Anyone can insert animated" on public.botanical_animated;
drop policy if exists "Anyone can update animated" on public.botanical_animated;
drop policy if exists "Anyone can delete animated" on public.botanical_animated;
revoke all on public.botanical_animated from public, anon, authenticated;
grant select on public.botanical_animated to authenticated;
grant all on public.botanical_animated to service_role;
create policy "Members read animation runs"
  on public.botanical_animated for select to authenticated
  using (public.is_app_member());

drop policy if exists "Anyone can read provider jobs" on public.animation_provider_jobs;
revoke all on public.animation_provider_jobs from public, anon, authenticated;
grant select on public.animation_provider_jobs to authenticated;
grant all on public.animation_provider_jobs to service_role;
create policy "Members read provider jobs"
  on public.animation_provider_jobs for select to authenticated
  using (public.is_app_member());

revoke all on public.animation_prompt_lab_jobs from public, anon, authenticated;
grant all on public.animation_prompt_lab_jobs to service_role;

revoke all on public.tiktok_send_jobs from public, anon, authenticated;
grant all on public.tiktok_send_jobs to service_role;

revoke all on public.tiktok_tokens from public, anon, authenticated;
grant all on public.tiktok_tokens to service_role;

-- OAuth credentials for YouTube and future platforms. TikTok's existing token
-- table remains supported while the publishing code is migrated incrementally.
create table if not exists public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('youtube')),
  account_id text not null,
  account_name text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, account_id)
);
alter table public.platform_connections enable row level security;
revoke all on public.platform_connections from public, anon, authenticated;
grant all on public.platform_connections to service_role;

create table if not exists public.platform_oauth_states (
  state_hash text primary key,
  platform text not null check (platform in ('tiktok','youtube')),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.platform_oauth_states enable row level security;
revoke all on public.platform_oauth_states from public, anon, authenticated;
grant all on public.platform_oauth_states to service_role;

create table if not exists public.content_publications (
  id uuid primary key default gen_random_uuid(),
  botanical_content_id uuid references public.botanical_content(id) on delete set null,
  animated_id uuid references public.botanical_animated(id) on delete set null,
  platform text not null check (platform in ('tiktok','youtube')),
  delivery_mode text not null check (delivery_mode in ('draft','private','manual','direct')),
  status text not null default 'queued' check (
    status in ('queued','uploading','delivered','published','failed','canceled')
  ),
  idempotency_key uuid not null unique,
  remote_publish_id text,
  remote_content_id text,
  remote_url text,
  title text,
  caption text,
  music_label text,
  experiment jsonb not null default '{}'::jsonb,
  error text,
  delivered_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (botanical_content_id is not null or animated_id is not null)
);
create index if not exists content_publications_content_idx
  on public.content_publications (botanical_content_id, created_at desc);
create index if not exists content_publications_platform_status_idx
  on public.content_publications (platform, status, created_at desc);
alter table public.content_publications enable row level security;
revoke all on public.content_publications from public, anon, authenticated;
grant select on public.content_publications to authenticated;
grant all on public.content_publications to service_role;
create policy "Members read publications"
  on public.content_publications for select to authenticated
  using (public.is_app_member());

alter table public.tiktok_send_jobs
  add column if not exists publication_id uuid references public.content_publications(id) on delete set null;
create unique index if not exists tiktok_send_jobs_publication_uniq
  on public.tiktok_send_jobs (publication_id) where publication_id is not null;

create table if not exists public.content_metrics (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.content_publications(id) on delete cascade,
  captured_at timestamptz not null default now(),
  views bigint,
  engaged_views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  watch_time_seconds numeric,
  average_view_duration_seconds numeric,
  average_view_percentage numeric,
  subscribers_gained bigint,
  estimated_revenue_usd numeric(12,4),
  raw jsonb not null default '{}'::jsonb
);
create index if not exists content_metrics_publication_idx
  on public.content_metrics (publication_id, captured_at desc);
alter table public.content_metrics enable row level security;
revoke all on public.content_metrics from public, anon, authenticated;
grant select on public.content_metrics to authenticated;
grant all on public.content_metrics to service_role;
create policy "Members read metrics"
  on public.content_metrics for select to authenticated
  using (public.is_app_member());

create table if not exists public.cost_events (
  id uuid primary key default gen_random_uuid(),
  botanical_content_id uuid references public.botanical_content(id) on delete set null,
  animated_id uuid references public.botanical_animated(id) on delete set null,
  provider text not null,
  model text not null,
  operation text not null,
  estimated_cost_usd numeric(12,4) not null check (estimated_cost_usd >= 0),
  actual_cost_usd numeric(12,4),
  status text not null check (status in ('confirmed','submitted','succeeded','failed','canceled')),
  provider_job_id text,
  created_at timestamptz not null default now()
);
alter table public.cost_events enable row level security;
revoke all on public.cost_events from public, anon, authenticated;
grant select on public.cost_events to authenticated;
grant all on public.cost_events to service_role;
create policy "Members read costs"
  on public.cost_events for select to authenticated
  using (public.is_app_member());

alter publication supabase_realtime add table public.content_publications;
alter publication supabase_realtime add table public.content_metrics;
