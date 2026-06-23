
CREATE TABLE public.botanical_animated (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_content_id uuid REFERENCES public.botanical_content(id) ON DELETE SET NULL,
  plant_name text,
  verified_fact text,
  script jsonb,
  caption text,
  still_urls text[] DEFAULT '{}'::text[],
  clip_urls text[] DEFAULT '{}'::text[],
  final_video_url text,
  progress jsonb NOT NULL DEFAULT '{"stage":"idle","steps":[]}'::jsonb,
  queue_status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.botanical_animated TO anon, authenticated;
GRANT ALL ON public.botanical_animated TO service_role;

ALTER TABLE public.botanical_animated ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read animated" ON public.botanical_animated FOR SELECT USING (true);
CREATE POLICY "Anyone can insert animated" ON public.botanical_animated FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update animated" ON public.botanical_animated FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete animated" ON public.botanical_animated FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.botanical_animated;
ALTER TABLE public.botanical_animated REPLICA IDENTITY FULL;
