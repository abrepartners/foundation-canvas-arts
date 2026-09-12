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

create table if not exists public.platform_oauth_states (
  state_hash text primary key,
  platform text not null check (platform in ('tiktok','youtube')),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

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

revoke all on public.platform_connections from public, anon, authenticated;
revoke all on public.platform_oauth_states from public, anon, authenticated;
revoke all on public.content_metrics from public, anon, authenticated;

grant all on public.platform_connections to service_role;
grant all on public.platform_oauth_states to service_role;
grant all on public.content_metrics to service_role;
grant select on public.content_metrics to authenticated;

alter table public.platform_connections enable row level security;
alter table public.platform_oauth_states enable row level security;
alter table public.content_metrics enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'content_metrics'
       and policyname = 'Members read metrics'
  ) then
    create policy "Members read metrics"
      on public.content_metrics for select to authenticated
      using (public.is_app_member());
  end if;
end $$;
