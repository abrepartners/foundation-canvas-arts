-- Idempotent repair: pieces of the checked-in baseline + follow-up migrations
-- that were never applied to this project. Additive only.

create table if not exists public.app_secrets (
  name text primary key,
  ciphertext text not null,
  iv text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from public, anon, authenticated;
grant all on public.app_secrets to service_role;

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
grant all on public.cost_events to service_role;
grant select on public.cost_events to authenticated;
drop policy if exists "Members read costs" on public.cost_events;
create policy "Members read costs"
  on public.cost_events for select to authenticated
  using (public.is_app_member());

create table if not exists public.still_generation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null unique,
  botanical_content_id uuid references public.botanical_content(id) on delete set null,
  image_provider text not null check (image_provider in ('replicate','openai')),
  model text not null,
  model_version text,
  text_model_version text,
  prompt_version text not null,
  pricing_version text not null,
  image_count integer not null default 6 check (image_count = 6),
  estimated_cost_usd numeric(12,4) not null check (estimated_cost_usd >= 0),
  confirmed_estimate_usd numeric(12,4) not null check (confirmed_estimate_usd >= 0),
  actual_cost_usd numeric(12,4),
  per_run_limit_usd numeric(12,4) not null check (per_run_limit_usd > 0),
  daily_limit_usd numeric(12,4) not null check (daily_limit_usd > 0),
  status text not null default 'claimed' check (
    status in (
      'claimed','generating_content','generating_images','succeeded',
      'partial_failed','failed','canceled','expired'
    )
  ),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists still_generation_runs_one_active_per_user_uniq
  on public.still_generation_runs (user_id)
  where status in ('claimed','generating_content','generating_images');
create index if not exists still_generation_runs_user_created_idx
  on public.still_generation_runs (user_id, created_at desc);
create index if not exists still_generation_runs_content_idx
  on public.still_generation_runs (botanical_content_id)
  where botanical_content_id is not null;

alter table public.still_generation_runs enable row level security;
revoke all on public.still_generation_runs from public, anon, authenticated;
grant all on public.still_generation_runs to service_role;
grant select on public.still_generation_runs to authenticated;
drop policy if exists "Members read still generation runs" on public.still_generation_runs;
create policy "Members read still generation runs"
  on public.still_generation_runs for select to authenticated
  using (public.is_app_member() and user_id = (select auth.uid()));

alter table public.botanical_content
  add column if not exists generation_run_id uuid
  references public.still_generation_runs(id) on delete set null;
create unique index if not exists botanical_content_generation_run_uniq
  on public.botanical_content (generation_run_id)
  where generation_run_id is not null;

alter table public.cost_events
  add column if not exists generation_run_id uuid
  references public.still_generation_runs(id) on delete set null;
create unique index if not exists cost_events_still_operation_uniq
  on public.cost_events (generation_run_id, operation)
  where generation_run_id is not null;
create unique index if not exists cost_events_regeneration_request_uniq
  on public.cost_events (botanical_content_id, operation)
  where botanical_content_id is not null
    and operation like 'regenerate:%';

create or replace function public.patch_botanical_visual(
  _content_id uuid,
  _moment text,
  _patch jsonb
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_visuals jsonb;
  updated_visuals jsonb;
begin
  select coalesce(nullif(script_visuals, '')::jsonb, '[]'::jsonb)
    into current_visuals
    from public.botanical_content
   where id = _content_id
   for update;

  if not found then
    raise exception 'Botanical content not found';
  end if;

  if not exists (
    select 1
      from jsonb_array_elements(current_visuals) as visual(item)
     where visual.item->>'moment' = _moment
  ) then
    raise exception 'Visual moment not found: %', _moment;
  end if;

  select jsonb_agg(
    case
      when item->>'moment' = _moment then item || coalesce(_patch, '{}'::jsonb)
      else item
    end
    order by ordinality
  )
    into updated_visuals
    from jsonb_array_elements(current_visuals) with ordinality as visual(item, ordinality);

  update public.botanical_content
     set script_visuals = coalesce(updated_visuals, '[]'::jsonb)::text
   where id = _content_id;

  return coalesce(updated_visuals, '[]'::jsonb)::text;
end;
$$;

revoke all on function public.patch_botanical_visual(uuid, text, jsonb) from public;
revoke all on function public.patch_botanical_visual(uuid, text, jsonb) from anon;
revoke all on function public.patch_botanical_visual(uuid, text, jsonb) from authenticated;
grant execute on function public.patch_botanical_visual(uuid, text, jsonb) to service_role;

create or replace function public.claim_still_generation_run(
  _user_id uuid,
  _idempotency_key uuid,
  _image_provider text,
  _model text,
  _prompt_version text,
  _pricing_version text,
  _estimated_cost_usd numeric,
  _confirmed_estimate_usd numeric,
  _per_run_limit_usd numeric,
  _daily_limit_usd numeric
) returns table(
  claimed boolean,
  run_id uuid,
  run_status text,
  content_id uuid,
  rejection_code text,
  daily_reserved_usd numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_row public.still_generation_runs%rowtype;
  active_row public.still_generation_runs%rowtype;
  new_row public.still_generation_runs%rowtype;
  reserved numeric(12,4);
begin
  perform pg_advisory_xact_lock(hashtextextended('still_generation:' || _user_id::text, 0));

  select * into existing_row
    from public.still_generation_runs
   where idempotency_key = _idempotency_key
     and user_id = _user_id;
  if found then
    return query select false, existing_row.id, existing_row.status,
      existing_row.botanical_content_id, null::text,
      coalesce(existing_row.estimated_cost_usd, 0);
    return;
  end if;

  update public.still_generation_runs
     set status = 'expired',
         error = coalesce(nullif(error, ''), 'Run expired before reaching a terminal state.'),
         completed_at = now(),
         updated_at = now()
   where user_id = _user_id
     and status in ('claimed','generating_content','generating_images')
     and updated_at < now() - interval '30 minutes';

  select * into active_row
    from public.still_generation_runs
   where user_id = _user_id
     and status in ('claimed','generating_content','generating_images')
   order by created_at desc
   limit 1;
  if found then
    return query select false, active_row.id, active_row.status,
      active_row.botanical_content_id, 'ACTIVE_RUN'::text, 0::numeric;
    return;
  end if;

  if _estimated_cost_usd > _per_run_limit_usd then
    return query select false, null::uuid, null::text, null::uuid,
      'PER_RUN_LIMIT'::text, 0::numeric;
    return;
  end if;

  select coalesce(sum(
    case
      when actual_cost_usd is not null then actual_cost_usd
      else estimated_cost_usd
    end
  ), 0)
    into reserved
    from public.still_generation_runs
   where user_id = _user_id
     and (created_at at time zone 'America/Chicago')::date =
       (now() at time zone 'America/Chicago')::date;

  if reserved + _estimated_cost_usd > _daily_limit_usd then
    return query select false, null::uuid, null::text, null::uuid,
      'DAILY_LIMIT'::text, reserved;
    return;
  end if;

  insert into public.still_generation_runs (
    user_id, idempotency_key, image_provider, model, prompt_version,
    pricing_version, estimated_cost_usd, confirmed_estimate_usd,
    per_run_limit_usd, daily_limit_usd, status
  ) values (
    _user_id, _idempotency_key, _image_provider, _model, _prompt_version,
    _pricing_version, _estimated_cost_usd, _confirmed_estimate_usd,
    _per_run_limit_usd, _daily_limit_usd, 'claimed'
  )
  returning * into new_row;

  return query select true, new_row.id, new_row.status,
    new_row.botanical_content_id, null::text, reserved;
end;
$$;

revoke execute on function public.claim_still_generation_run(
  uuid, uuid, text, text, text, text, numeric, numeric, numeric, numeric
) from public, anon, authenticated;
grant execute on function public.claim_still_generation_run(
  uuid, uuid, text, text, text, text, numeric, numeric, numeric, numeric
) to service_role;

notify pgrst, 'reload schema';
