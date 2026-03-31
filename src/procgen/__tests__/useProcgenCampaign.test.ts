import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bakeSectionFloorCache,
  hydrateProcgenCampaignBySession,
  persistCampaignSnapshotBySession,
} from '../../hooks/useProcgenCampaign';
import { useProcgenStore } from '../../stores/procgenStore';
import { generateSection } from '../engine/sectionGenerator';
import { createStarterCampaignSnapshot } from '../engine/campaignFlow';
import { loadMapBakeContent } from '../bake/AssetRegistryLoader';
import { getMapBakeContentSignature } from '../bake/AssetRegistryLoader';
import { stableHash } from '../bake/seededHash';

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
    vi.unstubAllGlobals();
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

  it('hydrates a browser-local campaign snapshot when procgen storage is unavailable', async () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });

    const localStorageMock = {
      getItem: vi.fn().mockReturnValue(
        JSON.stringify({
          version: 1,
          snapshot: starter,
        })
      ),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    };
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    });

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

    const campaign = await hydrateProcgenCampaignBySession('session_001');

    expect(campaign?.sessionId).toBe('session_001');
    expect(localStorageMock.getItem).toHaveBeenCalledWith(
      'tempest:endless-dungeon:campaign:session_001'
    );
    const state = useProcgenStore.getState();
    expect(state.campaign?.name).toBe('The Bloom Beneath');
    expect(Object.keys(state.sectionsById)).toHaveLength(1);
    expect(state.activeSectionId).toBe(starter.campaign.activeSectionId);
  });

  it('prefers a browser-local snapshot when the remote campaign row exists without sections', async () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });

    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn().mockReturnValue(
          JSON.stringify({
            version: 1,
            snapshot: starter,
          })
        ),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(),
        length: 0,
      },
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'procgen_campaigns') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'campaign_001',
              session_id: 'session_001',
              name: 'Broken Remote Campaign',
              world_seed: 'world_ironbell_042',
              campaign_goal_id: null,
              difficulty_model: 'distance_scaled_balanced',
              tone_profile: {},
              starting_section_id: 'section_start_village',
              active_section_id: 'section_start_village',
              dungeon_graph: { nodes: ['section_start_village'], edges: [] },
              generation_state: {},
              presentation_state: {},
              created_at: '2026-03-22T00:00:00.000Z',
              updated_at: '2026-03-22T00:00:00.000Z',
            },
            error: null,
          }),
        };
      }

      if (
        table === 'procgen_sections' ||
        table === 'procgen_room_states' ||
        table === 'procgen_overrides' ||
        table === 'procgen_section_previews' ||
        table === 'shared_assets'
      ) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const campaign = await hydrateProcgenCampaignBySession('session_001');

    expect(campaign?.name).toBe('The Bloom Beneath');
    const state = useProcgenStore.getState();
    expect(state.campaign?.name).toBe('The Bloom Beneath');
    expect(Object.keys(state.sectionsById)).toHaveLength(1);
  });

  it('prefers a richer browser-local snapshot when remote procgen state is stale', async () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });
    const expandedSnapshot = {
      ...starter,
      sections: [
        ...starter.sections,
        {
          ...starter.sections[0],
          id: 'section_record_section_remote_newer_001',
          sectionId: 'section_remote_newer_001',
          name: 'Spore Clouds Span',
          createdAt: '2026-03-30T13:40:00.000Z',
          updatedAt: '2026-03-30T13:40:00.000Z',
        },
      ],
      campaign: {
        ...starter.campaign,
        activeSectionId: 'section_remote_newer_001',
        updatedAt: '2026-03-30T13:40:00.000Z',
      },
    };

    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn().mockReturnValue(
          JSON.stringify({
            version: 1,
            snapshot: expandedSnapshot,
          })
        ),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(),
        length: 0,
      },
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'procgen_campaigns') {
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
              starting_section_id: starter.campaign.startingSectionId,
              active_section_id: starter.campaign.activeSectionId,
              dungeon_graph: { nodes: ['section_start_village'], edges: [] },
              generation_state: {},
              presentation_state: {},
              created_at: '2026-03-22T00:00:00.000Z',
              updated_at: '2026-03-22T00:00:00.000Z',
            },
            error: null,
          }),
        };
      }

      if (table === 'procgen_sections') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: starter.sections[0].id,
                campaign_id: 'campaign_001',
                section_id: starter.sections[0].sectionId,
                name: starter.sections[0].name,
                state: starter.sections[0].state,
                primary_biome_id: starter.sections[0].primaryBiomeId,
                secondary_biome_ids: starter.sections[0].secondaryBiomeIds,
                layout_type: starter.sections[0].layoutType,
                grid: {
                  width: starter.sections[0].grid.width,
                  height: starter.sections[0].grid.height,
                  tile_size_ft: starter.sections[0].grid.tileSizeFt,
                },
                room_ids: starter.sections[0].roomIds,
                entrance_connection_ids: starter.sections[0].entranceConnectionIds,
                exit_connection_ids: starter.sections[0].exitConnectionIds,
                generation_state: starter.sections[0].generationState,
                presentation_state: starter.sections[0].presentationState,
                override_state: starter.sections[0].overrideState,
                render_payload_cache: starter.sections[0].renderPayloadCache,
                locked_at: starter.sections[0].lockedAt,
                created_at: starter.sections[0].createdAt,
                updated_at: starter.sections[0].updatedAt,
              },
            ],
            error: null,
          }),
        };
      }

      if (
        table === 'procgen_room_states' ||
        table === 'procgen_overrides' ||
        table === 'procgen_section_previews' ||
        table === 'shared_assets'
      ) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const campaign = await hydrateProcgenCampaignBySession('session_001');

    expect(campaign?.activeSectionId).toBe('section_remote_newer_001');
    const state = useProcgenStore.getState();
    expect(state.campaign?.activeSectionId).toBe('section_remote_newer_001');
    expect(Object.keys(state.sectionsById)).toHaveLength(2);
  });

  it('bakes section floor cache and persists it onto procgen_sections', async () => {
    const updateMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'procgen_sections') {
        return {
          update: updateMock,
          eq: eqMock,
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    const generatedSection = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_bake_001',
      sectionKind: 'exploration',
    });

    useProcgenStore.getState().hydrateProcgenState({
      campaign: null,
      sections: [
        {
          id: 'section_record_001',
          campaignId: 'campaign_001',
          sectionId: 'section_bake_001',
          name: 'Baked Section',
          state: 'locked',
          primaryBiomeId: generatedSection.primaryBiomeId,
          secondaryBiomeIds: [],
          layoutType: generatedSection.layoutType,
          grid: generatedSection.grid,
          roomIds: generatedSection.rooms.map((room) => room.roomId),
          entranceConnectionIds: generatedSection.entranceRoomIds,
          exitConnectionIds: generatedSection.exitRoomIds,
          generationState: {
            generatedSection,
            generatedContent: undefined,
            sectionProfile: undefined,
            contentRerollState: undefined,
            settlementArchetypeId: null,
            coordinates: { x: 0, y: 0 },
            visitIndex: 0,
            enteredFromDirection: null,
            sectionKind: generatedSection.sectionKind,
          },
          presentationState: {},
          overrideState: {},
          renderPayloadCache: null,
          lockedAt: null,
          createdAt: '2026-03-26T00:00:00.000Z',
          updatedAt: '2026-03-26T00:00:00.000Z',
        },
      ],
      roomStates: [],
      overrides: [],
      sectionPreviews: [],
      sharedAssets: [],
    });

    const section = useProcgenStore.getState().sectionsById.section_record_001;
    const result = await bakeSectionFloorCache(section);

    expect(result.success).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(eqMock).toHaveBeenCalledWith('id', 'section_record_001');
    expect(
      useProcgenStore.getState().sectionsById.section_record_001?.renderPayloadCache?.bakedFloor
    ).toBeDefined();
    expect(
      (
        useProcgenStore.getState().sectionsById.section_record_001?.renderPayloadCache?.bakedFloor as {
          status?: string;
        }
      )?.status
    ).toBe('complete');
  });

  it('keeps the baked floor cache locally when persistence fails', async () => {
    const updateMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockResolvedValue({ error: { message: 'db write failed' } });

    fromMock.mockImplementation((table: string) => {
      if (table === 'procgen_sections') {
        return {
          update: updateMock,
          eq: eqMock,
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    const generatedSection = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_bake_002',
      sectionKind: 'exploration',
    });

    useProcgenStore.getState().hydrateProcgenState({
      campaign: null,
      sections: [
        {
          id: 'section_record_002',
          campaignId: 'campaign_001',
          sectionId: 'section_bake_002',
          name: 'Baked Section Persistence Failure',
          state: 'locked',
          primaryBiomeId: generatedSection.primaryBiomeId,
          secondaryBiomeIds: [],
          layoutType: generatedSection.layoutType,
          grid: generatedSection.grid,
          roomIds: generatedSection.rooms.map((room) => room.roomId),
          entranceConnectionIds: generatedSection.entranceRoomIds,
          exitConnectionIds: generatedSection.exitRoomIds,
          generationState: {
            generatedSection,
            generatedContent: undefined,
            sectionProfile: undefined,
            contentRerollState: undefined,
            settlementArchetypeId: null,
            coordinates: { x: 0, y: 0 },
            visitIndex: 0,
            enteredFromDirection: null,
            sectionKind: generatedSection.sectionKind,
          },
          presentationState: {},
          overrideState: {},
          renderPayloadCache: null,
          lockedAt: null,
          createdAt: '2026-03-26T00:00:00.000Z',
          updatedAt: '2026-03-26T00:00:00.000Z',
        },
      ],
      roomStates: [],
      overrides: [],
      sectionPreviews: [],
      sharedAssets: [],
    });

    const section = useProcgenStore.getState().sectionsById.section_record_002;
    const result = await bakeSectionFloorCache(section);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.persistenceError).toBe('db write failed');
    }
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(eqMock).toHaveBeenCalledWith('id', 'section_record_002');
    expect(
      (
        useProcgenStore.getState().sectionsById.section_record_002?.renderPayloadCache?.bakedFloor as {
          status?: string;
        }
      )?.status
    ).toBe('complete');
  });

  it('rebakes stale complete caches that have no sprite-backed chunk metadata', async () => {
    const updateMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'procgen_sections') {
        return {
          update: updateMock,
          eq: eqMock,
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    const generatedSection = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_bake_legacy_001',
      sectionKind: 'exploration',
    });

    useProcgenStore.getState().hydrateProcgenState({
      campaign: null,
      sections: [
        {
          id: 'section_record_legacy',
          campaignId: 'campaign_001',
          sectionId: 'section_bake_legacy_001',
          name: 'Legacy Baked Section',
          state: 'locked',
          primaryBiomeId: generatedSection.primaryBiomeId,
          secondaryBiomeIds: [],
          layoutType: generatedSection.layoutType,
          grid: generatedSection.grid,
          roomIds: generatedSection.rooms.map((room) => room.roomId),
          entranceConnectionIds: generatedSection.entranceRoomIds,
          exitConnectionIds: generatedSection.exitRoomIds,
          generationState: {
            generatedSection,
            generatedContent: undefined,
            sectionProfile: undefined,
            contentRerollState: undefined,
            settlementArchetypeId: null,
            coordinates: { x: 0, y: 0 },
            visitIndex: 0,
            enteredFromDirection: null,
            sectionKind: generatedSection.sectionKind,
          },
          presentationState: {},
          overrideState: {},
          renderPayloadCache: {
            bakedFloor: {
              status: 'complete',
              chunkSizePx: 1024,
              tileResolutionPx: 256,
              floorCellsPerChunk: 16,
              chunks: [
                {
                  chunkX: 0,
                  chunkY: 0,
                  x: 0,
                  y: 0,
                  widthPx: 1024,
                  heightPx: 1024,
                  imagePath: 'legacy/chunk_0_0.svg',
                  imageUrl: 'https://example.com/legacy/chunk_0_0.svg',
                },
              ],
            },
            bakeJobState: {
              mapId: generatedSection.sectionId,
              mapSeed: generatedSection.seed,
              pipelineVersion: 'tempest_visual_bake_v1',
              configVersion: '1.0',
              contentSignature: 'client_sprite_chunks_v3',
              status: 'complete',
              dirtyChunkKeys: [],
              completedChunkKeys: ['0:0'],
              chunkFingerprints: { '0:0': 'legacy' },
              bakedFloor: {
                status: 'complete',
                chunkSizePx: 1024,
                tileResolutionPx: 256,
                floorCellsPerChunk: 16,
                chunks: [
                  {
                    chunkX: 0,
                    chunkY: 0,
                    x: 0,
                    y: 0,
                    widthPx: 1024,
                    heightPx: 1024,
                    imagePath: 'legacy/chunk_0_0.svg',
                    imageUrl: 'https://example.com/legacy/chunk_0_0.svg',
                  },
                ],
              },
              lastCompletedAt: null,
              lastError: null,
            },
          },
          lockedAt: null,
          createdAt: '2026-03-26T00:00:00.000Z',
          updatedAt: '2026-03-26T00:00:00.000Z',
        },
      ],
      roomStates: [],
      overrides: [],
      sectionPreviews: [],
      sharedAssets: [],
    });

    const section = useProcgenStore.getState().sectionsById.section_record_legacy;
    const result = await bakeSectionFloorCache(section);

    expect(result.success).toBe(true);
    const bakedFloor = useProcgenStore.getState().sectionsById.section_record_legacy?.renderPayloadCache
      ?.bakedFloor as {
      chunks?: Array<{ tileSprites?: unknown[] }>;
    };

    expect(
      bakedFloor?.chunks?.some(
        (chunk) => Array.isArray(chunk.tileSprites) && chunk.tileSprites.length > 0
      )
    ).toBe(true);
  });

  it('persists snapshots using real procgen section row ids for preview links', async () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });
    const finalCampaignUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const previewDeleteEqMock = vi.fn().mockResolvedValue({ error: null });
    const previewInsertMock = vi.fn().mockResolvedValue({ error: null });
    const insertedCampaignRow = {
      id: '9a7a3d4d-d92f-4dc6-ac62-5b7e39c0ec10',
      session_id: 'session_001',
      name: starter.campaign.name,
      world_seed: starter.campaign.worldSeed,
      campaign_goal_id: null,
      difficulty_model: starter.campaign.difficultyModel,
      tone_profile: starter.campaign.toneProfile,
      starting_section_id: starter.campaign.startingSectionId,
      active_section_id: starter.campaign.activeSectionId,
      dungeon_graph: starter.campaign.dungeonGraph,
      generation_state: starter.campaign.generationState,
      presentation_state: starter.campaign.presentationState,
      created_at: starter.campaign.createdAt,
      updated_at: starter.campaign.updatedAt,
    };
    const persistedSections = [
      {
        id: '0c31bf42-1e66-4d13-8ba3-7792c47e3f34',
        campaign_id: insertedCampaignRow.id,
        section_id: starter.sections[0].sectionId,
        name: starter.sections[0].name,
        state: starter.sections[0].state,
        primary_biome_id: starter.sections[0].primaryBiomeId,
        secondary_biome_ids: starter.sections[0].secondaryBiomeIds,
        layout_type: starter.sections[0].layoutType,
        grid: {
          width: starter.sections[0].grid.width,
          height: starter.sections[0].grid.height,
          tile_size_ft: starter.sections[0].grid.tileSizeFt,
        },
        room_ids: starter.sections[0].roomIds,
        entrance_connection_ids: starter.sections[0].entranceConnectionIds,
        exit_connection_ids: starter.sections[0].exitConnectionIds,
        generation_state: starter.sections[0].generationState,
        presentation_state: starter.sections[0].presentationState,
        override_state: starter.sections[0].overrideState,
        render_payload_cache: starter.sections[0].renderPayloadCache,
        locked_at: starter.sections[0].lockedAt,
        created_at: starter.sections[0].createdAt,
        updated_at: starter.sections[0].updatedAt,
      },
    ];

    fromMock.mockImplementation((table: string) => {
      if (table === 'procgen_campaigns') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: finalCampaignUpdateEqMock,
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: insertedCampaignRow, error: null }),
            }),
          }),
        };
      }

      if (table === 'procgen_sections') {
        return {
          upsert: upsertMock,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: persistedSections, error: null }),
        };
      }

      if (table === 'procgen_section_previews') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: previewDeleteEqMock,
          }),
          insert: previewInsertMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await persistCampaignSnapshotBySession({
      sessionId: 'session_001',
      snapshot: starter,
    });

    expect(result.success).toBe(true);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(previewDeleteEqMock).toHaveBeenCalledWith('campaign_id', insertedCampaignRow.id);
    expect(previewInsertMock).toHaveBeenCalledTimes(1);
    expect(finalCampaignUpdateEqMock).toHaveBeenCalledWith('id', insertedCampaignRow.id);
    const previewRows = previewInsertMock.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(previewRows).toHaveLength(starter.previews.length);
    expect(previewRows[0]?.from_section_id).toBe(persistedSections[0].id);
    expect(
      (previewRows[0]?.preview_state as { adjacentFromSectionIds?: string[] }).adjacentFromSectionIds?.[0]
    ).toBe(persistedSections[0].id);
  });

  it('rebuilds baked floors when a cache was produced under the previous bake runtime format', async () => {
    const updateMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'procgen_sections') {
        return {
          update: updateMock,
          eq: eqMock,
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    const generatedSection = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_bake_legacy_001',
      sectionKind: 'exploration',
    });
    const content = loadMapBakeContent();
    const previousRuntimeSignature = stableHash(
      JSON.stringify({
        runtimeFormatVersion: 'floor_only_chunks_v10',
        pipelineConfig: content.pipelineConfig,
        visualMapping: content.visualMapping,
        assetRegistry: content.assetRegistry,
        transitionRegistry: content.transitionRegistry,
        proceduralTextureRegistry: content.proceduralTextureRegistry,
      })
    );
    expect(previousRuntimeSignature).not.toBe(getMapBakeContentSignature(content));

    useProcgenStore.getState().hydrateProcgenState({
      campaign: null,
      sections: [
        {
          id: 'section_record_runtime_migration',
          campaignId: 'campaign_001',
          sectionId: generatedSection.sectionId,
          name: 'Runtime Migration Section',
          state: 'locked',
          primaryBiomeId: generatedSection.primaryBiomeId,
          secondaryBiomeIds: [],
          layoutType: generatedSection.layoutType,
          grid: generatedSection.grid,
          roomIds: generatedSection.rooms.map((room) => room.roomId),
          entranceConnectionIds: generatedSection.entranceRoomIds,
          exitConnectionIds: generatedSection.exitRoomIds,
          generationState: {
            generatedSection,
            generatedContent: undefined,
            sectionProfile: undefined,
            contentRerollState: undefined,
            settlementArchetypeId: null,
            coordinates: { x: 0, y: 0 },
            visitIndex: 0,
            enteredFromDirection: null,
            sectionKind: generatedSection.sectionKind,
          },
          presentationState: {},
          overrideState: {},
          renderPayloadCache: {
            bakedFloor: {
              status: 'complete',
              chunkSizePx: 1024,
              tileResolutionPx: 256,
              floorCellsPerChunk: 16,
              chunks: [
                {
                  chunkX: 0,
                  chunkY: 0,
                  x: 0,
                  y: 0,
                  widthPx: 1024,
                  heightPx: 1024,
                  imagePath: 'legacy/chunk_0_0.svg',
                  imageUrl: 'https://example.com/legacy/chunk_0_0.svg',
                },
              ],
            },
            bakeJobState: {
              mapId: generatedSection.sectionId,
              mapSeed: generatedSection.seed,
              pipelineVersion: 'tempest_visual_bake_v1',
              configVersion: '1.0',
              contentSignature: previousRuntimeSignature,
              status: 'complete',
              dirtyChunkKeys: [],
              completedChunkKeys: ['0:0'],
              chunkFingerprints: { '0:0': 'legacy' },
              bakedFloor: {
                status: 'complete',
                chunkSizePx: 1024,
                tileResolutionPx: 256,
                floorCellsPerChunk: 16,
                chunks: [
                  {
                    chunkX: 0,
                    chunkY: 0,
                    x: 0,
                    y: 0,
                    widthPx: 1024,
                    heightPx: 1024,
                    imagePath: 'legacy/chunk_0_0.svg',
                    imageUrl: 'https://example.com/legacy/chunk_0_0.svg',
                  },
                ],
              },
              lastCompletedAt: null,
              lastError: null,
            },
          },
          lockedAt: null,
          createdAt: '2026-03-26T00:00:00.000Z',
          updatedAt: '2026-03-26T00:00:00.000Z',
        },
      ],
      roomStates: [],
      overrides: [],
      sectionPreviews: [],
      sharedAssets: [],
    });

    const section =
      useProcgenStore.getState().sectionsById.section_record_runtime_migration;
    const result = await bakeSectionFloorCache(section);

    expect(result.success).toBe(true);
    const bakedFloor =
      useProcgenStore.getState().sectionsById.section_record_runtime_migration
        ?.renderPayloadCache?.bakedFloor as {
        chunks?: Array<{ tileSprites?: unknown[] }>;
      };

    expect(
      bakedFloor?.chunks?.some(
        (chunk) => Array.isArray(chunk.tileSprites) && chunk.tileSprites.length > 0
      )
    ).toBe(true);
  });
});
