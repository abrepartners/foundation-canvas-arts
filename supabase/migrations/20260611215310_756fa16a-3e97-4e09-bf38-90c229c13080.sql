CREATE TABLE public.trend_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject text,
  verified_fact text,
  script text NOT NULL,
  thumbnail text,
  caption text,
  part2_hook text,
  script_visuals text,
  raw_content text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trend_content TO anon, authenticated;
GRANT ALL ON public.trend_content TO service_role;

ALTER TABLE public.trend_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read trend content"
  ON public.trend_content FOR SELECT USING (true);

CREATE POLICY "Anyone can insert trend content"
  ON public.trend_content FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can delete trend content"
  ON public.trend_content FOR DELETE USING (true);