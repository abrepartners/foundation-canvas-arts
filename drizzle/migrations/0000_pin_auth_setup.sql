create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_auth_settings (
  singleton boolean primary key default true check (singleton),
  passcode_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.pin_login_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  succeeded boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists pin_login_attempts_ip_time_idx
  on public.pin_login_attempts (ip_hash, attempted_at desc);
create index if not exists pin_login_attempts_time_idx
  on public.pin_login_attempts (attempted_at desc);

alter table public.app_auth_settings enable row level security;
alter table public.pin_login_attempts enable row level security;

revoke all on public.app_auth_settings from public, anon, authenticated;
revoke all on public.pin_login_attempts from public, anon, authenticated;
grant all on public.app_auth_settings to service_role;
grant all on public.pin_login_attempts to service_role;

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

revoke execute on function public.authenticate_app_pin(text, text)
  from public, anon, authenticated;
grant execute on function public.authenticate_app_pin(text, text) to service_role;
