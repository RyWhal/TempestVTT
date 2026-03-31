import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from '../useSession';
import { useSessionStore } from '../../stores/sessionStore';

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
    useSessionStore.getState().clearSession();
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
});
