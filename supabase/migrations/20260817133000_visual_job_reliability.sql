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

-- Normalize imported records. Completed files are authoritative. A missing image
-- that has claimed to be generating for more than ten minutes is interrupted,
-- not active, and should be made explicitly retryable.
with normalized as (
  select
    content.id,
    jsonb_agg(
      case
        when nullif(visual.item->>'image_url', '') is not null then
          visual.item || jsonb_build_object(
            'status', 'done',
            'error', null,
            'completed_at', coalesce(visual.item->>'completed_at', now()::text)
          )
        when visual.item->>'status' = 'generating'
          and coalesce((visual.item->>'started_at')::timestamptz, content.created_at)
            < now() - interval '10 minutes' then
          visual.item || jsonb_build_object(
            'status', 'error',
            'error', 'Generation was interrupted before an image was saved. Retry this image.',
            'completed_at', now()::text
          )
        else visual.item
      end
      order by visual.ordinality
    ) as visuals
  from public.botanical_content as content
  cross join lateral jsonb_array_elements(
    coalesce(nullif(content.script_visuals, '')::jsonb, '[]'::jsonb)
  ) with ordinality as visual(item, ordinality)
  group by content.id
)
update public.botanical_content as content
   set script_visuals = normalized.visuals::text
  from normalized
 where content.id = normalized.id;

notify pgrst, 'reload schema';
