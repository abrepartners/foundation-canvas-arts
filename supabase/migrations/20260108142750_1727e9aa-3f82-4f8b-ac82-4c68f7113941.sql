-- Create the storage bucket for faceless visuals
INSERT INTO storage.buckets (id, name, public)
VALUES ('botanical-faceless-visuals', 'botanical-faceless-visuals', true);

-- Allow public read access
CREATE POLICY "Public read access for faceless visuals"
ON storage.objects FOR SELECT
USING (bucket_id = 'botanical-faceless-visuals');

-- Allow service role to insert
CREATE POLICY "Service role can upload faceless visuals"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'botanical-faceless-visuals');

-- Allow service role to update (for re-uploads)
CREATE POLICY "Service role can update faceless visuals"
ON storage.objects FOR UPDATE
USING (bucket_id = 'botanical-faceless-visuals');

-- Allow service role to delete (for cleanup)
CREATE POLICY "Service role can delete faceless visuals"
ON storage.objects FOR DELETE
USING (bucket_id = 'botanical-faceless-visuals');