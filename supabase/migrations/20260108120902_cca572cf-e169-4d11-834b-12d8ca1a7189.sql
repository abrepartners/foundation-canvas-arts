-- Create table for botanical content history
CREATE TABLE public.botanical_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plant_name TEXT,
  script TEXT NOT NULL,
  thumbnail TEXT,
  caption TEXT,
  part2_hook TEXT,
  script_visuals TEXT,
  raw_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.botanical_content ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for simplicity (no auth required)
CREATE POLICY "Anyone can read content" 
ON public.botanical_content 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert content" 
ON public.botanical_content 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can delete content" 
ON public.botanical_content 
FOR DELETE 
USING (true);

-- Add index for faster ordering
CREATE INDEX idx_botanical_content_created_at ON public.botanical_content(created_at DESC);