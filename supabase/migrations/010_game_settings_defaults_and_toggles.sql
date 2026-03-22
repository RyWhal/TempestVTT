-- Generalized game settings defaults and feature toggles

ALTER TABLE sessions
ALTER COLUMN allow_players_rename_npcs SET DEFAULT TRUE,
ALTER COLUMN allow_players_move_npcs SET DEFAULT TRUE;

UPDATE sessions
SET
  allow_players_rename_npcs = COALESCE(allow_players_rename_npcs, TRUE),
  allow_players_move_npcs = COALESCE(allow_players_move_npcs, TRUE)
WHERE allow_players_rename_npcs IS NULL
   OR allow_players_move_npcs IS NULL;

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS enable_initiative_phase BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS enable_plot_dice BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS allow_players_drawings BOOLEAN DEFAULT TRUE;

UPDATE sessions
SET
  enable_initiative_phase = COALESCE(enable_initiative_phase, TRUE),
  enable_plot_dice = COALESCE(enable_plot_dice, TRUE),
  allow_players_drawings = COALESCE(allow_players_drawings, TRUE)
WHERE enable_initiative_phase IS NULL
   OR enable_plot_dice IS NULL
   OR allow_players_drawings IS NULL;
