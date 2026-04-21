-- Allow session-level control over player character renaming

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS allow_players_rename_pcs BOOLEAN DEFAULT TRUE;

UPDATE sessions
SET allow_players_rename_pcs = COALESCE(allow_players_rename_pcs, TRUE)
WHERE allow_players_rename_pcs IS NULL;

CREATE OR REPLACE FUNCTION app_admin_get_sessions_with_counts(p_token TEXT)
RETURNS TABLE (
  id UUID,
  code VARCHAR(10),
  name VARCHAR(100),
  active_map_id UUID,
  current_gm_username VARCHAR(50),
  notepad_content TEXT,
  allow_players_rename_npcs BOOLEAN,
  allow_players_rename_pcs BOOLEAN,
  allow_players_move_npcs BOOLEAN,
  enable_initiative_phase BOOLEAN,
  enable_plot_dice BOOLEAN,
  allow_players_drawings BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  player_count BIGINT,
  map_count BIGINT,
  character_count BIGINT,
  last_activity TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM app_require_admin_session(p_token);

  RETURN QUERY
  SELECT
    s.id,
    s.code,
    s.name,
    s.active_map_id,
    s.current_gm_username,
    s.notepad_content,
    s.allow_players_rename_npcs,
    s.allow_players_rename_pcs,
    s.allow_players_move_npcs,
    s.enable_initiative_phase,
    s.enable_plot_dice,
    s.allow_players_drawings,
    s.created_at,
    s.updated_at,
    COUNT(DISTINCT sp.id) AS player_count,
    COUNT(DISTINCT m.id) AS map_count,
    COUNT(DISTINCT c.id) AS character_count,
    s.updated_at AS last_activity
  FROM sessions s
  LEFT JOIN session_players sp ON sp.session_id = s.id
  LEFT JOIN maps m ON m.session_id = s.id
  LEFT JOIN characters c ON c.session_id = s.id
  GROUP BY s.id
  ORDER BY s.updated_at DESC;
END;
$$;
