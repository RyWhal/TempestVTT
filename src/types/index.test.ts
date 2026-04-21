import { describe, expect, it } from 'vitest';
import { dbMapToMap, dbSessionToSession } from './index';

describe('dbMapToMap', () => {
  it('hydrates token size override fields from the db row', () => {
    const map = dbMapToMap({
      id: 'map_001',
      session_id: 'session_001',
      name: 'Room One',
      image_url: 'https://example.com/map.png',
      width: 1000,
      height: 800,
      sort_order: 0,
      created_at: '2026-04-06T00:00:00.000Z',
      grid_enabled: true,
      grid_offset_x: 0,
      grid_offset_y: 0,
      grid_cell_size: 50,
      grid_color: '#000000',
      token_size_override_enabled: true,
      medium_token_size_px: 72,
      fog_enabled: false,
      fog_default_state: 'revealed',
      fog_data: [],
      drawing_data: [],
      effects_enabled: false,
      effect_data: [],
      show_player_tokens: true,
    });

    expect(map.tokenSizeOverrideEnabled).toBe(true);
    expect(map.mediumTokenSizePx).toBe(72);
  });
});

describe('dbSessionToSession', () => {
  it('hydrates the player PC rename setting from the db row', () => {
    const session = dbSessionToSession({
      id: 'session_001',
      code: 'ABCD12',
      name: 'Shared Table',
      active_map_id: null,
      current_gm_username: 'DungeonMaster',
      notepad_content: '',
      allow_players_rename_npcs: true,
      allow_players_rename_pcs: false,
      allow_players_move_npcs: true,
      enable_initiative_phase: true,
      enable_plot_dice: true,
      allow_players_drawings: true,
      created_at: '2026-04-08T00:00:00.000Z',
      updated_at: '2026-04-08T00:00:00.000Z',
    });

    expect(session.allowPlayersRenamePcs).toBe(false);
  });
});
