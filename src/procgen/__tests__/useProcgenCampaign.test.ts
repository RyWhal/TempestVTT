import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hydrateProcgenCampaignBySession } from '../../hooks/useProcgenCampaign';
import { useProcgenStore } from '../../stores/procgenStore';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

describe('hydrateProcgenCampaignBySession', () => {
  beforeEach(() => {
    fromMock.mockReset();
    useProcgenStore.getState().clearProcgenState();
  });

  it('hydrates a campaign and related rows from session scope', async () => {
    fromMock.mockImplementation((table: string) => {
      switch (table) {
        case 'procgen_campaigns':
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'campaign_001',
                session_id: 'session_001',
                name: 'The Bloom Beneath',
                world_seed: 'world_ironbell_042',
                campaign_goal_id: null,
                difficulty_model: 'distance_scaled_balanced',
                tone_profile: {},
                starting_section_id: 'section_start_001',
                active_section_id: 'section_start_001',
                dungeon_graph: { nodes: ['section_start_001'], edges: [] },
                generation_state: {},
                presentation_state: {},
                created_at: '2026-03-22T00:00:00.000Z',
                updated_at: '2026-03-22T00:00:00.000Z',
              },
              error: null,
            }),
          };
        case 'procgen_sections':
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'section_record_001',
                  campaign_id: 'campaign_001',
                  section_id: 'section_start_001',
                  name: 'The Blooming Chapel',
                  state: 'preview',
                  primary_biome_id: 'fungal_warrens',
                  secondary_biome_ids: [],
                  layout_type: 'central_hub',
                  grid: { width: 100, height: 100, tile_size_ft: 5 },
                  room_ids: ['room_001'],
                  entrance_connection_ids: ['entrance_west_01'],
                  exit_connection_ids: ['exit_east_01'],
                  generation_state: {},
                  presentation_state: {},
                  override_state: {},
                  render_payload_cache: null,
                  locked_at: null,
                  created_at: '2026-03-22T00:00:00.000Z',
                  updated_at: '2026-03-22T00:00:00.000Z',
                },
              ],
              error: null,
            }),
          };
        case 'procgen_room_states':
        case 'procgen_overrides':
        case 'procgen_section_previews':
        case 'shared_assets':
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        default:
          throw new Error(`Unexpected table: ${table}`);
      }
    });

    const campaign = await hydrateProcgenCampaignBySession('session_001');

    expect(campaign?.id).toBe('campaign_001');

    const state = useProcgenStore.getState();
    expect(state.campaign?.id).toBe('campaign_001');
    expect(state.activeSectionId).toBe('section_start_001');
    expect(Object.keys(state.sectionsById)).toHaveLength(1);
    expect(state.error).toBeNull();
  });

  it('clears procgen state when a session has no campaign yet', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'procgen_campaigns') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    useProcgenStore.getState().setError('stale');

    const campaign = await hydrateProcgenCampaignBySession('session_001');

    expect(campaign).toBeNull();

    const state = useProcgenStore.getState();
    expect(state.campaign).toBeNull();
    expect(state.sectionsById).toEqual({});
    expect(state.error).toBeNull();
  });
});
