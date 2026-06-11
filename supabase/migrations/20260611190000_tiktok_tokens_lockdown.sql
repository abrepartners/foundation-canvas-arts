-- Explicitly deny all client access to tiktok_tokens. RLS-with-no-policies
-- already denies, but these named policies make the intent unmistakable and
-- guard against a future permissive policy being added carelessly.
-- The service role bypasses RLS, so edge functions are unaffected.
revoke all on table public.tiktok_tokens from anon, authenticated;

create policy "tiktok_tokens_no_select" on public.tiktok_tokens
  for select to anon, authenticated using (false);

create policy "tiktok_tokens_no_insert" on public.tiktok_tokens
  for insert to anon, authenticated with check (false);

create policy "tiktok_tokens_no_update" on public.tiktok_tokens
  for update to anon, authenticated using (false);

create policy "tiktok_tokens_no_delete" on public.tiktok_tokens
  for delete to anon, authenticated using (false);
