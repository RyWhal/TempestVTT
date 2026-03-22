-- DunGEN procedural campaign storage
-- Canonical campaign state lives here instead of being forced into the image-backed maps table.

CREATE TABLE IF NOT EXISTS procgen_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  world_seed VARCHAR(255) NOT NULL,
  campaign_goal_id VARCHAR(120),
  difficulty_model VARCHAR(120) NOT NULL DEFAULT 'distance_scaled_balanced',
  tone_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  starting_section_id VARCHAR(120),
  active_section_id VARCHAR(120),
  dungeon_graph JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  generation_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  presentation_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN procgen_campaigns.dungeon_graph IS 'Canonical world graph for generated sections and connections.';
COMMENT ON COLUMN procgen_campaigns.generation_state IS 'Canonical generation-layer state. Do not store transient table UI state here.';
COMMENT ON COLUMN procgen_campaigns.presentation_state IS 'Table-facing presentation state that may be reset or recomputed without changing canon.';

CREATE TABLE IF NOT EXISTS procgen_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES procgen_campaigns(id) ON DELETE CASCADE,
  section_id VARCHAR(120) NOT NULL,
  name VARCHAR(120) NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'preview',
  primary_biome_id VARCHAR(120) NOT NULL,
  secondary_biome_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  layout_type VARCHAR(120) NOT NULL,
  grid JSONB NOT NULL DEFAULT '{"width":100,"height":100,"tile_size_ft":5}'::jsonb,
  room_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  entrance_connection_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  exit_connection_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  generation_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  presentation_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  override_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  render_payload_cache JSONB,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, section_id)
);

COMMENT ON COLUMN procgen_sections.generation_state IS 'Canonical section content and resolved generated data.';
COMMENT ON COLUMN procgen_sections.presentation_state IS 'Player-facing temporary state for this section.';
COMMENT ON COLUMN procgen_sections.override_state IS 'Explicit GM-authored canonical overrides applied to the generated section.';

CREATE TABLE IF NOT EXISTS procgen_room_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES procgen_campaigns(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES procgen_sections(id) ON DELETE CASCADE,
  room_id VARCHAR(120) NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'preview',
  canonical_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  runtime_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  presentation_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  override_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(section_id, room_id)
);

COMMENT ON COLUMN procgen_room_states.canonical_state IS 'Canonical room content once accepted.';
COMMENT ON COLUMN procgen_room_states.runtime_state IS 'Persistent gameplay consequences such as dead, looted, or modified states.';
COMMENT ON COLUMN procgen_room_states.presentation_state IS 'Temporary session-facing state that should not overwrite canon.';

CREATE TABLE IF NOT EXISTS procgen_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES procgen_campaigns(id) ON DELETE CASCADE,
  section_id UUID REFERENCES procgen_sections(id) ON DELETE CASCADE,
  room_state_id UUID REFERENCES procgen_room_states(id) ON DELETE CASCADE,
  target_type VARCHAR(80) NOT NULL,
  target_id VARCHAR(120) NOT NULL,
  patch_type VARCHAR(120) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  author VARCHAR(80) NOT NULL DEFAULT 'gm',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procgen_section_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES procgen_campaigns(id) ON DELETE CASCADE,
  from_section_id UUID REFERENCES procgen_sections(id) ON DELETE CASCADE,
  section_stub_id VARCHAR(120) NOT NULL,
  direction VARCHAR(40),
  preview_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, section_stub_id)
);

CREATE INDEX IF NOT EXISTS idx_procgen_campaigns_session ON procgen_campaigns(session_id);
CREATE INDEX IF NOT EXISTS idx_procgen_sections_campaign ON procgen_sections(campaign_id);
CREATE INDEX IF NOT EXISTS idx_procgen_room_states_campaign ON procgen_room_states(campaign_id);
CREATE INDEX IF NOT EXISTS idx_procgen_room_states_section ON procgen_room_states(section_id);
CREATE INDEX IF NOT EXISTS idx_procgen_overrides_campaign ON procgen_overrides(campaign_id);
CREATE INDEX IF NOT EXISTS idx_procgen_section_previews_campaign ON procgen_section_previews(campaign_id);

ALTER TABLE procgen_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE procgen_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE procgen_room_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE procgen_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE procgen_section_previews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on procgen_campaigns"
ON procgen_campaigns FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on procgen_sections"
ON procgen_sections FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on procgen_room_states"
ON procgen_room_states FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on procgen_overrides"
ON procgen_overrides FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on procgen_section_previews"
ON procgen_section_previews FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE procgen_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE procgen_sections;
ALTER PUBLICATION supabase_realtime ADD TABLE procgen_room_states;
ALTER PUBLICATION supabase_realtime ADD TABLE procgen_overrides;
ALTER PUBLICATION supabase_realtime ADD TABLE procgen_section_previews;

CREATE TRIGGER update_procgen_campaigns_updated_at
  BEFORE UPDATE ON procgen_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_procgen_sections_updated_at
  BEFORE UPDATE ON procgen_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_procgen_room_states_updated_at
  BEFORE UPDATE ON procgen_room_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_procgen_overrides_updated_at
  BEFORE UPDATE ON procgen_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_procgen_section_previews_updated_at
  BEFORE UPDATE ON procgen_section_previews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
