import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildGeneratedSessionMapState,
  resetSessionLoadQueueForTests,
  runDedupedSessionLoad,
  useSession,
} from '../useSession';
import { useSessionStore } from '../../stores/sessionStore';
import { useProcgenStore } from '../../stores/procgenStore';
import { createStarterCampaignSnapshot } from '../../procgen/engine/campaignFlow';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('../../lib/sessionCode', () => ({
  generateSessionCode: () => 'ABCD12',
}));

describe('useSession.createSession', () => {
  beforeEach(() => {
    fromMock.mockReset();
    resetSessionLoadQueueForTests();
    useSessionStore.getState().clearSession();
    useProcgenStore.getState().clearProcgenState();
  });

  it('can create a session without activating it in the session store', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'sessions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'session_001',
                  code: 'ABCD12',
                  name: 'Endless Dungeon Campaign',
                  current_gm_username: 'DungeonMaster',
                  current_scene: null,
                  grid_settings: {},
                  permissions: {},
                  allow_players_rename_npcs: false,
                  allow_players_move_npcs: false,
                  enable_initiative_phase: false,
                  enable_plot_dice: false,
                  allow_players_drawings: false,
                  created_at: '2026-03-30T12:00:00.000Z',
                  updated_at: '2026-03-30T12:00:00.000Z',
                  active_map_id: null,
                  notepad_content: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'session_players') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    let createSession:
      | ((
          sessionName: string,
          username: string,
          options?: { activateSession?: boolean }
        ) => Promise<unknown>)
      | null = null;
    const Harness = () => {
      createSession = useSession().createSession;
      return null;
    };

    renderToString(<Harness />);

    if (!createSession) {
      throw new Error('Harness did not initialize useSession');
    }

    const createSessionFn = createSession as (
      sessionName: string,
      username: string,
      options?: { activateSession?: boolean }
    ) => Promise<unknown>;
    const createResult = await createSessionFn('Endless Dungeon Campaign', 'DungeonMaster', {
      activateSession: false,
    });

    expect(createResult).toMatchObject({
      success: true,
      code: 'ABCD12',
      session: {
        id: 'session_001',
        code: 'ABCD12',
        name: 'Endless Dungeon Campaign',
      },
      currentUser: {
        username: 'DungeonMaster',
        characterId: null,
        isGm: true,
      },
    });
    expect(useSessionStore.getState().session).toBeNull();
    expect(useSessionStore.getState().currentUser).toBeNull();
  });

  it('builds generated session map state without requiring the full session hydration query fanout', async () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'Endless Dungeon Campaign',
      worldSeed: 'world_ironbell_042',
    });

    useProcgenStore.getState().hydrateProcgenState({
      campaign: starter.campaign,
      sections: starter.sections,
      roomStates: [],
      overrides: [],
      sectionPreviews: starter.previews,
      sharedAssets: [],
    });

    const loadCampaignBySession = vi.fn().mockResolvedValue(starter.campaign);
    const bakeSectionFloorCache = vi.fn().mockResolvedValue({
      success: true as const,
      renderPayloadCache: {
        bakedFloor: {
          status: 'complete',
          chunks: [{ imageUrl: 'https://example.com/chunk.png' }],
        },
      },
    });

    const result = await buildGeneratedSessionMapState({
      sessionId: 'session_001',
      uploadedMaps: [],
      uploadedActiveMapId: null,
      loadCampaignBySession,
      bakeSectionFloorCache,
    });

    expect(loadCampaignBySession).toHaveBeenCalledTimes(1);
    expect(bakeSectionFloorCache).toHaveBeenCalledTimes(starter.sections.length);
    expect(result).not.toBeNull();
    expect(result?.maps).toHaveLength(starter.sections.length);
    expect(result?.activeMap?.sourceType).toBe('generated');
    expect(result?.activeMap?.generatedSectionId).toBe(starter.campaign.activeSectionId);
  });

  it('can join a session without blocking on the full hydration query fanout', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'sessions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'session_002',
              code: 'JOIN12',
              name: 'Endless Dungeon Campaign',
              current_gm_username: 'Goober',
              current_scene: null,
              grid_settings: {},
              permissions: {},
              allow_players_rename_npcs: false,
              allow_players_move_npcs: false,
              enable_initiative_phase: false,
              enable_plot_dice: false,
              allow_players_drawings: false,
              created_at: '2026-04-01T10:00:00.000Z',
              updated_at: '2026-04-01T10:00:00.000Z',
              active_map_id: null,
              notepad_content: null,
            },
            error: null,
          }),
        };
      }

      if (table === 'session_players') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'player_002',
              is_gm: true,
              character_id: null,
            },
            error: null,
          }),
          update: vi.fn().mockReturnThis(),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    let joinSession:
      | ((
          code: string,
          username: string,
          options?: { hydrateSession?: boolean }
        ) => Promise<{ success: boolean; error?: string }>)
      | null = null;
    const Harness = () => {
      joinSession = useSession().joinSession;
      return null;
    };

    renderToString(<Harness />);

    if (!joinSession) {
      throw new Error('Harness did not initialize useSession');
    }

    const joinSessionFn = joinSession as (
      code: string,
      username: string,
      options?: { hydrateSession?: boolean }
    ) => Promise<{ success: boolean; error?: string }>;
    const result = await joinSessionFn('JOIN12', 'Goober', { hydrateSession: false });

    expect(result).toEqual({ success: true });
    expect(fromMock.mock.calls.map((call) => call[0])).not.toContain('maps');
    expect(useSessionStore.getState().session).toMatchObject({
      id: 'session_002',
      code: 'JOIN12',
    });
    expect(useSessionStore.getState().currentUser).toMatchObject({
      username: 'Goober',
      isGm: true,
    });
  });

  it('dedupes overlapping session hydrations for the same session and load profile', async () => {
    let resolveMaps: ((value: { data: []; error: null }) => void) | null = null;
    const mapsOrderMock = vi.fn(
      () =>
        new Promise<{ data: []; error: null }>((resolve) => {
          resolveMaps = resolve;
        })
    );
    const mapSelectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: mapsOrderMock,
      }),
    });

    fromMock.mockImplementation((table: string) => {
      if (table === 'maps') {
        return {
          select: mapSelectMock,
        };
      }

      if (table === 'sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { active_map_id: null },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'characters') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }

      if (table === 'session_players') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }

      if (
        table === 'procgen_campaigns' ||
        table === 'procgen_sections' ||
        table === 'procgen_room_states' ||
        table === 'procgen_overrides' ||
        table === 'procgen_section_previews' ||
        table === 'shared_assets'
      ) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle:
            table === 'procgen_campaigns'
              ? vi.fn().mockResolvedValue({ data: null, error: null })
              : undefined,
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    let loadSessionData: ((sessionId: string) => Promise<void>) | null = null;
    const Harness = () => {
      loadSessionData = useSession().loadSessionData;
      return null;
    };

    renderToString(<Harness />);

    if (!loadSessionData) {
      throw new Error('Harness did not initialize useSession');
    }

    const loadSessionDataFn = loadSessionData as (sessionId: string) => Promise<void>;
    const firstLoad = loadSessionDataFn('session_001');
    const secondLoad = loadSessionDataFn('session_001');

    expect(mapsOrderMock).toHaveBeenCalledTimes(1);

    const resolveMapsFn = resolveMaps as ((value: { data: []; error: null }) => void) | null;
    resolveMapsFn?.({ data: [], error: null });
    await Promise.all([firstLoad, secondLoad]);

    expect(mapSelectMock).toHaveBeenCalledTimes(1);
  });

  it('hydrates core table state without eagerly loading chat, initiative, or npc library data', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'maps') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }

      if (table === 'sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { active_map_id: null },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'characters' || table === 'session_players') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }

      if (
        table === 'procgen_campaigns' ||
        table === 'procgen_sections' ||
        table === 'procgen_room_states' ||
        table === 'procgen_overrides' ||
        table === 'procgen_section_previews' ||
        table === 'shared_assets'
      ) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle:
            table === 'procgen_campaigns'
              ? vi.fn().mockResolvedValue({ data: null, error: null })
              : undefined,
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    let loadSessionData: ((sessionId: string) => Promise<void>) | null = null;
    const Harness = () => {
      loadSessionData = useSession().loadSessionData;
      return null;
    };

    renderToString(<Harness />);

    if (!loadSessionData) {
      throw new Error('Harness did not initialize useSession');
    }

    const loadSessionDataFn = loadSessionData as (sessionId: string) => Promise<void>;
    await loadSessionDataFn('session_001');

    const requestedTables = fromMock.mock.calls.map((call) => call[0]);
    expect(requestedTables).toContain('maps');
    expect(requestedTables).toContain('characters');
    expect(requestedTables).toContain('session_players');
    expect(requestedTables).not.toContain('npc_templates');
    expect(requestedTables).not.toContain('chat_messages');
    expect(requestedTables).not.toContain('dice_rolls');
    expect(requestedTables).not.toContain('initiative_entries');
    expect(requestedTables).not.toContain('initiative_roll_logs');
  });

  it('loads deferred chat, initiative, and npc library data only when requested', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'chat_messages' || table === 'dice_rolls' || table === 'initiative_roll_logs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }

      if (table === 'initiative_entries') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }

      if (table === 'npc_templates') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    let loadChatData: ((sessionId?: string) => Promise<void>) | null = null;
    let loadInitiativeData: ((sessionId?: string) => Promise<void>) | null = null;
    let loadNpcTemplateData: ((sessionId?: string) => Promise<void>) | null = null;
    const Harness = () => {
      const sessionApi = useSession();
      loadChatData = sessionApi.loadChatData;
      loadInitiativeData = sessionApi.loadInitiativeData;
      loadNpcTemplateData = sessionApi.loadNpcTemplateData;
      return null;
    };

    renderToString(<Harness />);

    if (!loadChatData || !loadInitiativeData || !loadNpcTemplateData) {
      throw new Error('Harness did not initialize deferred session loaders');
    }

    const loadChatDataFn = loadChatData as (sessionId?: string) => Promise<void>;
    const loadInitiativeDataFn = loadInitiativeData as (sessionId?: string) => Promise<void>;
    const loadNpcTemplateDataFn = loadNpcTemplateData as (sessionId?: string) => Promise<void>;

    await loadChatDataFn('session_001');
    await loadInitiativeDataFn('session_001');
    await loadNpcTemplateDataFn('session_001');

    const requestedTables = fromMock.mock.calls.map((call) => call[0]);
    expect(requestedTables).toContain('chat_messages');
    expect(requestedTables).toContain('dice_rolls');
    expect(requestedTables).toContain('initiative_entries');
    expect(requestedTables).toContain('initiative_roll_logs');
    expect(requestedTables).toContain('npc_templates');
    expect(requestedTables).not.toContain('maps');
  });

  it('queues a follow-up generated sync when another request arrives during an in-flight load', async () => {
    const callOrder: string[] = [];
    let releaseFirstLoad: (() => void) | null = null;

    const loader = vi.fn(async () => {
      callOrder.push(`start:${loader.mock.calls.length}`);
      if (loader.mock.calls.length === 1) {
        await new Promise<void>((resolve) => {
          releaseFirstLoad = resolve;
        });
      }
      callOrder.push(`end:${loader.mock.calls.length}`);
    });

    const firstLoad = runDedupedSessionLoad('generated:session_001', loader, {
      rerunIfRequested: true,
    });
    const secondLoad = runDedupedSessionLoad('generated:session_001', loader, {
      rerunIfRequested: true,
    });

    expect(loader).toHaveBeenCalledTimes(1);

    const releaseFirstLoadFn = releaseFirstLoad as (() => void) | null;
    releaseFirstLoadFn?.();
    await Promise.all([firstLoad, secondLoad]);
    await Promise.resolve();

    expect(loader).toHaveBeenCalledTimes(2);
    expect(callOrder).toEqual(['start:1', 'end:1', 'start:2', 'end:2']);
  });
});
