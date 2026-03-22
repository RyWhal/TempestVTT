-- Admin and Global Assets Schema
-- Run this SQL in your Supabase SQL Editor after 001 and 002

-- System settings table (for admin password, etc.)
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default admin password (should be changed after first login)
INSERT INTO system_settings (key, value)
VALUES ('admin_password', 'tempest-admin-2024')
ON CONFLICT (key) DO NOTHING;

-- Global asset library (tokens and maps that can be shared across sessions)
CREATE TABLE IF NOT EXISTS global_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type VARCHAR(20) NOT NULL, -- 'token' or 'map'
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT NOT NULL,

  -- For tokens
  default_size VARCHAR(20) DEFAULT 'medium',
  category VARCHAR(50), -- e.g., 'monster', 'npc', 'hero', 'environmental'

  -- For maps
  width INT,
  height INT,

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin activity log
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100) NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_global_assets_type ON global_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_global_assets_category ON global_assets(category);
CREATE INDEX IF NOT EXISTS idx_global_assets_active ON global_assets(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- Policies (open for simplicity - admin auth is handled in application)
CREATE POLICY "Allow all on system_settings" ON system_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on global_assets" ON global_assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on admin_logs" ON admin_logs FOR ALL USING (true) WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_assets_updated_at
    BEFORE UPDATE ON global_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
