create table if not exists public.app_secrets (
  name text primary key,
  ciphertext text not null,
  iv text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from public, anon, authenticated;
grant all on public.app_secrets to service_role;
