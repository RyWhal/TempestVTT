-- GM settings + initiative support

-- Session-level GM permissions
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS allow_players_rename_npcs BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS allow_players_move_npcs BOOLEAN DEFAULT FALSE;

-- Per-player initiative modifier
ALTER TABLE session_players
ADD COLUMN IF NOT EXISTS initiative_modifier INT DEFAULT 0;

-- Initiative entries (shared tracker)
CREATE TABLE IF NOT EXISTS initiative_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('player', 'npc')),
  source_id UUID,
  source_name VARCHAR(100) NOT NULL,
  rolled_by_username VARCHAR(50) NOT NULL,
  modifier INT DEFAULT 0,
  roll_value INT,
  total INT,
  phase VARCHAR(10) NOT NULL DEFAULT 'fast' CHECK (phase IN ('fast', 'slow')),
  visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'gm_only')),
  is_manual_override BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_initiative_entries_session
  ON initiative_entries(session_id, phase, total DESC, created_at ASC);

ALTER TABLE initiative_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on initiative_entries"
  ON initiative_entries
  FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE initiative_entries;

CREATE TRIGGER update_initiative_entries_updated_at
    BEFORE UPDATE ON initiative_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
