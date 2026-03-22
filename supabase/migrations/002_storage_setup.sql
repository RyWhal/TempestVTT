-- Storage bucket setup for Tempest Table
-- Run this in the Supabase SQL Editor or configure via Dashboard

-- Create storage buckets (if using SQL - you may need to do this via Dashboard)
-- Note: Supabase typically requires bucket creation via Dashboard or API

-- Storage policies for the 'maps' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('maps', 'maps', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the 'tokens' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('tokens', 'tokens', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to maps bucket
CREATE POLICY "Public read access for maps"
ON storage.objects FOR SELECT
USING (bucket_id = 'maps');

-- Allow authenticated uploads to maps bucket (using anon key)
CREATE POLICY "Allow uploads to maps bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'maps');

-- Allow updates to maps bucket
CREATE POLICY "Allow updates to maps bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'maps');

-- Allow deletes from maps bucket
CREATE POLICY "Allow deletes from maps bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'maps');

-- Allow public read access to tokens bucket
CREATE POLICY "Public read access for tokens"
ON storage.objects FOR SELECT
USING (bucket_id = 'tokens');

-- Allow uploads to tokens bucket
CREATE POLICY "Allow uploads to tokens bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tokens');

-- Allow updates to tokens bucket
CREATE POLICY "Allow updates to tokens bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tokens');

-- Allow deletes from tokens bucket
CREATE POLICY "Allow deletes from tokens bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'tokens');
