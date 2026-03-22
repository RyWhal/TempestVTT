-- Storage bucket setup for handout images

INSERT INTO storage.buckets (id, name, public)
VALUES ('handouts', 'handouts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for handouts"
ON storage.objects FOR SELECT
USING (bucket_id = 'handouts');

CREATE POLICY "Allow uploads to handouts bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'handouts');

CREATE POLICY "Allow updates to handouts bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'handouts');

CREATE POLICY "Allow deletes from handouts bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'handouts');
