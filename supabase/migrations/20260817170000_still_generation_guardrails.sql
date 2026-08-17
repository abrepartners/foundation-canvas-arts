create table public.still_generation_runs (
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
      'claimed',
      'generating_content',
      'generating_images',
      'succeeded',
      'partial_failed',
      'failed',
      'canceled',
      'expired'
    )
  ),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index still_generation_runs_one_active_per_user_uniq
  on public.still_generation_runs (user_id)
  where status in ('claimed','generating_content','generating_images');
create index still_generation_runs_user_created_idx
  on public.still_generation_runs (user_id, created_at desc);

alter table public.botanical_content
  add column generation_run_id uuid unique
  references public.still_generation_runs(id) on delete set null;

alter table public.cost_events
  add column generation_run_id uuid
  references public.still_generation_runs(id) on delete set null;

create unique index cost_events_still_operation_uniq
  on public.cost_events (generation_run_id, operation)
  where generation_run_id is not null;

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
    user_id,
    idempotency_key,
    image_provider,
    model,
    prompt_version,
    pricing_version,
    estimated_cost_usd,
    confirmed_estimate_usd,
    per_run_limit_usd,
    daily_limit_usd,
    status
  ) values (
    _user_id,
    _idempotency_key,
    _image_provider,
    _model,
    _prompt_version,
    _pricing_version,
    _estimated_cost_usd,
    _confirmed_estimate_usd,
    _per_run_limit_usd,
    _daily_limit_usd,
    'claimed'
  )
  returning * into new_row;

  return query select true, new_row.id, new_row.status,
    new_row.botanical_content_id, null::text, reserved;
end;
$$;

alter table public.still_generation_runs enable row level security;
revoke all on public.still_generation_runs from public, anon, authenticated;
grant all on public.still_generation_runs to service_role;
grant select on public.still_generation_runs to authenticated;

revoke execute on function public.claim_still_generation_run(
  uuid, uuid, text, text, text, text, numeric, numeric, numeric, numeric
) from public, anon, authenticated;
grant execute on function public.claim_still_generation_run(
  uuid, uuid, text, text, text, text, numeric, numeric, numeric, numeric
) to service_role;

create policy "Members read still generation runs"
  on public.still_generation_runs for select to authenticated
  using (public.is_app_member() and user_id = auth.uid());
