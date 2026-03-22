-- Tempest Table Initial Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension (should already be enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  active_map_id UUID,
  current_gm_username VARCHAR(50),
  notepad_content TEXT DEFAULT ''
);

-- Maps belonging to a session
CREATE TABLE IF NOT EXISTS maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  image_url TEXT NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  grid_enabled BOOLEAN DEFAULT TRUE,
  grid_offset_x INT DEFAULT 0,
  grid_offset_y INT DEFAULT 0,
  grid_cell_size INT DEFAULT 50,
  grid_color VARCHAR(20) DEFAULT 'rgba(0,0,0,0.3)',
  fog_enabled BOOLEAN DEFAULT TRUE,
  fog_default_state VARCHAR(10) DEFAULT 'fogged',
  fog_data JSONB DEFAULT '[]',
  show_player_tokens BOOLEAN DEFAULT TRUE
);

-- Add foreign key reference to sessions for active_map_id
ALTER TABLE sessions
ADD CONSTRAINT fk_active_map
FOREIGN KEY (active_map_id)
REFERENCES maps(id)
ON DELETE SET NULL;

-- Player Characters (persistent across maps)
CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  token_url TEXT,
  position_x FLOAT DEFAULT 100,
  position_y FLOAT DEFAULT 100,
  is_claimed BOOLEAN DEFAULT FALSE,
  claimed_by_username VARCHAR(50),
  inventory JSONB DEFAULT '[]',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active players in session
CREATE TABLE IF NOT EXISTS session_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  is_gm BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, username)
);

-- NPC Library (templates for reuse)
CREATE TABLE IF NOT EXISTS npc_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  token_url TEXT,
  default_size VARCHAR(20) DEFAULT 'medium',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NPC Instances (placed on maps)
CREATE TABLE IF NOT EXISTS npc_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID REFERENCES maps(id) ON DELETE CASCADE,
  template_id UUID REFERENCES npc_templates(id) ON DELETE SET NULL,
  display_name VARCHAR(100),
  token_url TEXT,
  size VARCHAR(20),
  position_x FLOAT NOT NULL,
  position_y FLOAT NOT NULL,
  is_visible BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dice roll log
CREATE TABLE IF NOT EXISTS dice_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL,
  character_name VARCHAR(100),
  roll_expression VARCHAR(100) NOT NULL,
  roll_results JSONB NOT NULL,
  visibility VARCHAR(20) DEFAULT 'public',
  plot_dice_results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  is_gm_announcement BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_players_session ON session_players(session_id);
CREATE INDEX IF NOT EXISTS idx_maps_session ON maps(session_id);
CREATE INDEX IF NOT EXISTS idx_characters_session ON characters(session_id);
CREATE INDEX IF NOT EXISTS idx_npc_templates_session ON npc_templates(session_id);
CREATE INDEX IF NOT EXISTS idx_npc_instances_map ON npc_instances(map_id);
CREATE INDEX IF NOT EXISTS idx_dice_rolls_session ON dice_rolls(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at DESC);

-- Enable Row Level Security (optional, but recommended)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE npc_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE npc_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE dice_rolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- For a trust-based system without auth, allow all operations
-- In production, you might want more restrictive policies
CREATE POLICY "Allow all operations on sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on maps" ON maps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on characters" ON characters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on session_players" ON session_players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on npc_templates" ON npc_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on npc_instances" ON npc_instances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on dice_rolls" ON dice_rolls FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on chat_messages" ON chat_messages FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE maps;
ALTER PUBLICATION supabase_realtime ADD TABLE characters;
ALTER PUBLICATION supabase_realtime ADD TABLE session_players;
ALTER PUBLICATION supabase_realtime ADD TABLE npc_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE npc_instances;
ALTER PUBLICATION supabase_realtime ADD TABLE dice_rolls;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on sessions
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
