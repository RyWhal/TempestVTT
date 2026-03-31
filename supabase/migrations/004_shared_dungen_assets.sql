-- DunGEN shared assets are global and reusable across campaigns and sessions.
-- Canonical content stores asset references or keys, not duplicated blobs.

CREATE TABLE IF NOT EXISTS shared_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_key VARCHAR(255) NOT NULL UNIQUE,
  asset_type VARCHAR(80) NOT NULL,
  generation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  prompt_version VARCHAR(80),
  source_fingerprint TEXT NOT NULL,
  storage_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN shared_assets.asset_key IS 'Stable content-addressed asset identifier derived from canonical DunGEN inputs.';
COMMENT ON COLUMN shared_assets.source_fingerprint IS 'Fingerprint of the prompt inputs and content identity used for cache reuse.';
COMMENT ON COLUMN shared_assets.metadata IS 'Non-canonical generation metadata. Missing assets must never block play.';

CREATE INDEX IF NOT EXISTS idx_shared_assets_type ON shared_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_shared_assets_status ON shared_assets(generation_status);

ALTER TABLE shared_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on shared_assets"
ON shared_assets FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE shared_assets;

CREATE TRIGGER update_shared_assets_updated_at
  BEFORE UPDATE ON shared_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
