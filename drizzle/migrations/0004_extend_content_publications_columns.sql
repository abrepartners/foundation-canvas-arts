alter table public.content_publications
  add column if not exists animated_id uuid references public.botanical_animated(id) on delete set null,
  add column if not exists remote_content_id text,
  add column if not exists remote_url text,
  add column if not exists music_label text,
  add column if not exists experiment jsonb not null default '{}'::jsonb,
  add column if not exists delivered_at timestamptz,
  add column if not exists published_at timestamptz;

create index if not exists content_publications_platform_status_idx
  on public.content_publications (platform, status, created_at desc);
create index if not exists content_publications_content_idx
  on public.content_publications (botanical_content_id, created_at desc);
