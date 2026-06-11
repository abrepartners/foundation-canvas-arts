-- Stores TikTok OAuth tokens for the connected posting account.
-- Service-role access only: RLS enabled with no policies, so anon/auth
-- clients cannot read tokens. Edge functions use the service role key.
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

alter table public.tiktok_tokens enable row level security;
