create table if not exists public.tiktok_tokens (
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

grant all on public.tiktok_tokens to service_role;

alter table public.tiktok_tokens enable row level security;