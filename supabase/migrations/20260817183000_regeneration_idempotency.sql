create unique index if not exists cost_events_regeneration_request_uniq
  on public.cost_events (botanical_content_id, operation)
  where botanical_content_id is not null
    and operation like 'regenerate:%';
