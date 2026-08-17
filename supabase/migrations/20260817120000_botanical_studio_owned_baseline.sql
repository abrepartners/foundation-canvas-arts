create extension if not exists pgcrypto with schema extensions;

create table public.botanical_content (
  id uuid primary key default gen_random_uuid(),
  plant_name text,
  script text not null,
  thumbnail text,
  caption text,
  part2_hook text,
  script_visuals text,
  raw_content text,
  created_at timestamptz not null default now(),
  verified_fact text,
  virality_score integer,
  score_reasoning text,
  hook_variants jsonb,
  queue_status text not null default 'pending'
);

create index idx_botanical_content_created_at
  on public.botanical_content (created_at desc);
create index botanical_content_queue_status_idx
  on public.botanical_content (queue_status, created_at desc);

create table public.trend_content (
  id uuid primary key default gen_random_uuid(),
  subject text,
  verified_fact text,
  script text not null,
  thumbnail text,
  caption text,
  part2_hook text,
  script_visuals text,
  raw_content text,
  created_at timestamptz not null default now()
);

create table public.botanical_animated (
  id uuid primary key default gen_random_uuid(),
  source_content_id uuid references public.botanical_content(id) on delete set null,
  plant_name text,
  verified_fact text,
  script jsonb,
  caption text,
  still_urls text[] default '{}'::text[],
  clip_urls text[] default '{}'::text[],
  final_video_url text,
  progress jsonb not null default '{"stage":"idle","steps":[]}'::jsonb,
  queue_status text not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cost_breakdown jsonb not null default '{}'::jsonb,
  cost_usd numeric(10,4),
  retry_counts jsonb not null default '{}'::jsonb,
  stop_requested_at timestamptz,
  cost_confirmed_estimate_usd numeric(10,4),
  cost_confirmed_at timestamptz,
  pricing_version text
);

alter table public.botanical_animated replica identity full;
create unique index botanical_animated_single_active_uniq
  on public.botanical_animated ((queue_status is not null))
  where queue_status in ('pending_confirmation','generating','stills_ready','animating','stitching');

create table public.animation_provider_jobs (
  id uuid primary key default gen_random_uuid(),
  row_id uuid not null references public.botanical_animated(id) on delete cascade,
  job_key text not null,
  provider text not null default 'replicate',
  model text,
  prediction_id text,
  status text not null default 'claimed',
  attempt integer not null default 1,
  output_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  output_data text
);

create unique index animation_provider_jobs_active_uniq
  on public.animation_provider_jobs (row_id, job_key)
  where status in ('claimed','submitting','running');
create index animation_provider_jobs_row_key_attempt_idx
  on public.animation_provider_jobs (row_id, job_key, attempt desc);

create table public.animation_prompt_lab_jobs (
  id uuid primary key default gen_random_uuid(),
  animation_row_id uuid not null references public.botanical_animated(id) on delete cascade,
  idempotency_key uuid not null unique,
  still_index integer not null check (still_index between 0 and 5),
  still_url text not null,
  archetype text not null check (archetype in ('growth_reveal', 'living_specimen', 'archival_evidence')),
  model_key text not null check (model_key in ('seedance_1_5_pro', 'seedance_2_mini', 'kling_standard')),
  model text not null,
  duration_seconds integer not null check (duration_seconds between 2 and 15),
  resolution text not null,
  prompt_version text not null,
  prompt text not null,
  status text not null default 'queued' check (
    status in ('queued', 'preparing_start_frame', 'submitting_video', 'running', 'succeeded', 'failed', 'canceled')
  ),
  provider_status text,
  estimated_cost_usd numeric(10,4) not null,
  pricing_version text not null,
  cost_confirmed_at timestamptz not null,
  start_frame_prediction_id text,
  start_frame_url text,
  video_prediction_id text,
  output_url text,
  stop_requested_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index animation_prompt_lab_one_active_uniq
  on public.animation_prompt_lab_jobs ((1))
  where status in ('queued', 'preparing_start_frame', 'submitting_video', 'running');
create index animation_prompt_lab_row_created_idx
  on public.animation_prompt_lab_jobs (animation_row_id, created_at desc);

create table public.app_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now()
);

create table public.tiktok_tokens (
  id uuid primary key default gen_random_uuid(),
  open_id text not null unique,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_connections (
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

create table public.platform_oauth_states (
  state_hash text primary key,
  platform text not null check (platform in ('tiktok','youtube')),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.content_publications (
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

create index content_publications_content_idx
  on public.content_publications (botanical_content_id, created_at desc);
create index content_publications_platform_status_idx
  on public.content_publications (platform, status, created_at desc);

create table public.tiktok_send_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  content_id uuid,
  phase text not null default 'queued',
  publish_id text,
  tiktok_status text,
  fail_reason text,
  raw jsonb,
  publication_id uuid references public.content_publications(id) on delete set null
);

create index tiktok_send_jobs_created_at_idx
  on public.tiktok_send_jobs (created_at desc);
create unique index tiktok_send_jobs_publication_uniq
  on public.tiktok_send_jobs (publication_id) where publication_id is not null;

create table public.content_metrics (
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

create index content_metrics_publication_idx
  on public.content_metrics (publication_id, captured_at desc);

create table public.cost_events (
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

create table public.app_auth_settings (
  singleton boolean primary key default true check (singleton),
  passcode_hash text not null,
  updated_at timestamptz not null default now()
);

create table public.app_secrets (
  name text primary key,
  ciphertext text not null,
  iv text not null,
  updated_at timestamptz not null default now()
);

create table public.pin_login_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  succeeded boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index pin_login_attempts_ip_time_idx
  on public.pin_login_attempts (ip_hash, attempted_at desc);
create index pin_login_attempts_time_idx
  on public.pin_login_attempts (attempted_at desc);

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

create or replace function public.consume_animation_retry(
  _row_id uuid,
  _bucket text,
  _limit_value integer
) returns table(allowed boolean, used integer, limit_value integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  cur integer;
  nxt integer;
begin
  select coalesce((retry_counts ->> _bucket)::int, 0) into cur
    from public.botanical_animated
   where id = _row_id
   for update;
  if cur is null then
    return query select false, 0, _limit_value;
    return;
  end if;
  if cur >= _limit_value then
    return query select false, cur, _limit_value;
    return;
  end if;
  nxt := cur + 1;
  update public.botanical_animated
     set retry_counts = retry_counts || jsonb_build_object(_bucket, nxt),
         updated_at = now()
   where id = _row_id;
  return query select true, nxt, _limit_value;
end;
$$;

create or replace function public.claim_provider_job(
  _row_id uuid,
  _job_key text,
  _provider text,
  _model text,
  _max_attempts integer
) returns table(
  claimed boolean,
  exhausted boolean,
  job_id uuid,
  job_status text,
  attempt integer,
  prediction_id text,
  output_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_row public.animation_provider_jobs%rowtype;
  latest_row public.animation_provider_jobs%rowtype;
  new_row public.animation_provider_jobs%rowtype;
  attempts_total integer;
begin
  perform 1 from public.botanical_animated where id = _row_id for update;

  select * into active_row
    from public.animation_provider_jobs
   where row_id = _row_id and job_key = _job_key
     and status in ('claimed','submitting','running')
   order by attempt desc limit 1;
  if found then
    return query select false, false, active_row.id, active_row.status,
      active_row.attempt, active_row.prediction_id, active_row.output_url;
    return;
  end if;

  select * into latest_row
    from public.animation_provider_jobs
   where row_id = _row_id and job_key = _job_key
     and status = 'succeeded'
   order by attempt desc limit 1;
  if found then
    return query select false, false, latest_row.id, latest_row.status,
      latest_row.attempt, latest_row.prediction_id, latest_row.output_url;
    return;
  end if;

  select count(*) into attempts_total
    from public.animation_provider_jobs
   where row_id = _row_id and job_key = _job_key;

  if attempts_total >= _max_attempts then
    select * into latest_row
      from public.animation_provider_jobs
     where row_id = _row_id and job_key = _job_key
     order by attempt desc limit 1;
    return query select false, true, latest_row.id, latest_row.status,
      latest_row.attempt, latest_row.prediction_id, latest_row.output_url;
    return;
  end if;

  insert into public.animation_provider_jobs
    (row_id, job_key, provider, model, status, attempt)
  values
    (_row_id, _job_key, _provider, _model, 'claimed', attempts_total + 1)
  returning * into new_row;

  return query select true, false, new_row.id, new_row.status,
    new_row.attempt, new_row.prediction_id, new_row.output_url;
end;
$$;

create or replace function public.guarded_update_animated(
  _row_id uuid,
  _patch jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_status text;
  cur_stop timestamptz;
begin
  select queue_status, stop_requested_at into cur_status, cur_stop
    from public.botanical_animated where id = _row_id for update;
  if cur_status is null then return false; end if;
  if cur_stop is not null then return false; end if;
  if cur_status in ('canceled','error','done') then return false; end if;

  update public.botanical_animated
     set queue_status = coalesce(_patch->>'queue_status', queue_status),
         source_content_id = case
           when _patch ? 'source_content_id'
             then nullif(_patch->>'source_content_id', '')::uuid
           else source_content_id
         end,
         plant_name = coalesce(_patch->>'plant_name', plant_name),
         verified_fact = coalesce(_patch->>'verified_fact', verified_fact),
         script = coalesce(_patch->'script', script),
         caption = coalesce(_patch->>'caption', caption),
         progress = coalesce(_patch->'progress', progress),
         clip_urls = coalesce(
           case when _patch ? 'clip_urls'
             then array(select jsonb_array_elements_text(_patch->'clip_urls'))
             else null end,
           clip_urls
         ),
         still_urls = coalesce(
           case when _patch ? 'still_urls'
             then array(select jsonb_array_elements_text(_patch->'still_urls'))
             else null end,
           still_urls
         ),
         final_video_url = coalesce(_patch->>'final_video_url', final_video_url),
         cost_breakdown = coalesce(_patch->'cost_breakdown', cost_breakdown),
         cost_usd = coalesce(nullif(_patch->>'cost_usd','')::numeric, cost_usd),
         error = case when _patch ? 'error' then _patch->>'error' else error end,
         updated_at = now()
   where id = _row_id;
  return true;
end;
$$;

create or replace function public.expire_stale_active_animated(
  _threshold_seconds integer default 1800
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  with candidates as (
    select ba.id
      from public.botanical_animated ba
     where ba.queue_status in ('generating','animating','stitching')
       and ba.updated_at < now() - make_interval(secs => _threshold_seconds)
       and ba.stop_requested_at is null
       and not exists (
         select 1 from public.animation_provider_jobs pj
          where pj.row_id = ba.id
            and pj.status in ('claimed','submitting','running')
       )
  )
  update public.botanical_animated ba
     set queue_status = 'error',
         error = coalesce(nullif(ba.error,''), '') ||
           case when coalesce(ba.error,'') = '' then '' else ' | ' end ||
           'Auto-expired: stale active row (no in-flight provider jobs, idle > '
           || _threshold_seconds || 's).',
         updated_at = now()
   where ba.id in (select id from candidates);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.authenticate_app_pin(
  _passcode text,
  _ip_hash text
) returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
  ip_failures integer;
  global_failures integer;
  valid boolean;
begin
  select passcode_hash into stored_hash
    from public.app_auth_settings
   where singleton = true;

  if stored_hash is null then return 'not_configured'; end if;

  select count(*) into ip_failures
    from public.pin_login_attempts
   where ip_hash = _ip_hash
     and succeeded = false
     and attempted_at > now() - interval '15 minutes';

  select count(*) into global_failures
    from public.pin_login_attempts
   where succeeded = false
     and attempted_at > now() - interval '1 hour';

  if ip_failures >= 5 or global_failures >= 100 then
    return 'rate_limited';
  end if;

  valid := extensions.crypt(left(coalesce(_passcode, ''), 32), stored_hash) = stored_hash;
  insert into public.pin_login_attempts (ip_hash, succeeded) values (_ip_hash, valid);

  if valid then
    delete from public.pin_login_attempts where attempted_at < now() - interval '7 days';
    return 'ok';
  end if;
  return 'invalid';
end;
$$;

alter table public.botanical_content enable row level security;
alter table public.trend_content enable row level security;
alter table public.botanical_animated enable row level security;
alter table public.animation_provider_jobs enable row level security;
alter table public.animation_prompt_lab_jobs enable row level security;
alter table public.app_members enable row level security;
alter table public.tiktok_tokens enable row level security;
alter table public.platform_connections enable row level security;
alter table public.platform_oauth_states enable row level security;
alter table public.content_publications enable row level security;
alter table public.tiktok_send_jobs enable row level security;
alter table public.content_metrics enable row level security;
alter table public.cost_events enable row level security;
alter table public.app_auth_settings enable row level security;
alter table public.app_secrets enable row level security;
alter table public.pin_login_attempts enable row level security;

revoke all on all tables in schema public from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

grant select on public.botanical_content to authenticated;
grant select on public.trend_content to authenticated;
grant select on public.botanical_animated to authenticated;
grant select on public.animation_provider_jobs to authenticated;
grant select on public.content_publications to authenticated;
grant select on public.content_metrics to authenticated;
grant select on public.cost_events to authenticated;

revoke execute on function public.is_app_member() from public, anon;
grant execute on function public.is_app_member() to authenticated, service_role;

revoke execute on function public.consume_animation_retry(uuid, text, integer)
  from public, anon, authenticated;
revoke execute on function public.claim_provider_job(uuid, text, text, text, integer)
  from public, anon, authenticated;
revoke execute on function public.guarded_update_animated(uuid, jsonb)
  from public, anon, authenticated;
revoke execute on function public.expire_stale_active_animated(integer)
  from public, anon, authenticated;
revoke execute on function public.authenticate_app_pin(text, text)
  from public, anon, authenticated;

grant execute on function public.consume_animation_retry(uuid, text, integer) to service_role;
grant execute on function public.claim_provider_job(uuid, text, text, text, integer) to service_role;
grant execute on function public.guarded_update_animated(uuid, jsonb) to service_role;
grant execute on function public.expire_stale_active_animated(integer) to service_role;
grant execute on function public.authenticate_app_pin(text, text) to service_role;

create policy "Members read botanical content"
  on public.botanical_content for select to authenticated
  using (public.is_app_member());
create policy "Members read trend content"
  on public.trend_content for select to authenticated
  using (public.is_app_member());
create policy "Members read animation runs"
  on public.botanical_animated for select to authenticated
  using (public.is_app_member());
create policy "Members read provider jobs"
  on public.animation_provider_jobs for select to authenticated
  using (public.is_app_member());
create policy "Members read publications"
  on public.content_publications for select to authenticated
  using (public.is_app_member());
create policy "Members read metrics"
  on public.content_metrics for select to authenticated
  using (public.is_app_member());
create policy "Members read costs"
  on public.cost_events for select to authenticated
  using (public.is_app_member());

insert into storage.buckets (id, name, public)
values ('botanical-faceless-visuals', 'botanical-faceless-visuals', true)
on conflict (id) do update set public = excluded.public;

create policy "Service role uploads faceless visuals"
  on storage.objects for insert to service_role
  with check (bucket_id = 'botanical-faceless-visuals');
create policy "Service role updates faceless visuals"
  on storage.objects for update to service_role
  using (bucket_id = 'botanical-faceless-visuals');
create policy "Service role deletes faceless visuals"
  on storage.objects for delete to service_role
  using (bucket_id = 'botanical-faceless-visuals');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'botanical_animated'
  ) then
    alter publication supabase_realtime add table public.botanical_animated;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'content_publications'
  ) then
    alter publication supabase_realtime add table public.content_publications;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'content_metrics'
  ) then
    alter publication supabase_realtime add table public.content_metrics;
  end if;
end;
$$;
