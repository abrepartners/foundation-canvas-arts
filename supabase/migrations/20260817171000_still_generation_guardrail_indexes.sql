create index still_generation_runs_content_idx
  on public.still_generation_runs (botanical_content_id)
  where botanical_content_id is not null;

drop policy if exists "Members read still generation runs"
  on public.still_generation_runs;
create policy "Members read still generation runs"
  on public.still_generation_runs for select to authenticated
  using (public.is_app_member() and user_id = (select auth.uid()));
