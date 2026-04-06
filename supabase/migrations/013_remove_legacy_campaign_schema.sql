-- Remove the extracted campaign schema from StormlightVTT.
-- Safe for upgrade runs after the repo split.

ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS procgen_section_previews;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS procgen_overrides;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS procgen_room_states;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS procgen_sections;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS procgen_campaigns;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS shared_assets;

DROP TRIGGER IF EXISTS update_procgen_section_previews_updated_at ON procgen_section_previews;
DROP TRIGGER IF EXISTS update_procgen_overrides_updated_at ON procgen_overrides;
DROP TRIGGER IF EXISTS update_procgen_room_states_updated_at ON procgen_room_states;
DROP TRIGGER IF EXISTS update_procgen_sections_updated_at ON procgen_sections;
DROP TRIGGER IF EXISTS update_procgen_campaigns_updated_at ON procgen_campaigns;
DROP TRIGGER IF EXISTS update_shared_assets_updated_at ON shared_assets;

DROP POLICY IF EXISTS "Allow all operations on procgen_section_previews" ON procgen_section_previews;
DROP POLICY IF EXISTS "Allow all operations on procgen_overrides" ON procgen_overrides;
DROP POLICY IF EXISTS "Allow all operations on procgen_room_states" ON procgen_room_states;
DROP POLICY IF EXISTS "Allow all operations on procgen_sections" ON procgen_sections;
DROP POLICY IF EXISTS "Allow all operations on procgen_campaigns" ON procgen_campaigns;
DROP POLICY IF EXISTS "Allow all operations on shared_assets" ON shared_assets;

DROP TABLE IF EXISTS procgen_section_previews CASCADE;
DROP TABLE IF EXISTS procgen_overrides CASCADE;
DROP TABLE IF EXISTS procgen_room_states CASCADE;
DROP TABLE IF EXISTS procgen_sections CASCADE;
DROP TABLE IF EXISTS procgen_campaigns CASCADE;
DROP TABLE IF EXISTS shared_assets CASCADE;
