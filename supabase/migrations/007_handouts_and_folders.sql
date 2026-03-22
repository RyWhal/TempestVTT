-- Handouts support

CREATE TABLE IF NOT EXISTS handouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  image_url TEXT,
  body TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handouts_session ON handouts(session_id);

ALTER TABLE handouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on handouts" ON handouts FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE handouts;
