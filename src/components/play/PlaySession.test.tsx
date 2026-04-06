/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaySession } from './PlaySession';
import { useMapStore } from '../../stores/mapStore';
import { useSessionStore } from '../../stores/sessionStore';

const { updateDrawingDataMock } = vi.hoisted(() => ({
  updateDrawingDataMock: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../map/MapCanvas', () => ({
  MapCanvas: () => <div>Map Canvas</div>,
}));

vi.mock('../chat/ChatPanel', () => ({
  ChatPanel: () => <div>Chat Panel</div>,
}));

vi.mock('../dice/DicePanel', () => ({
  DicePanel: () => <div>Dice Panel</div>,
}));

vi.mock('../gm/GMPanel', () => ({
  GMPanel: () => <div>GM Panel</div>,
}));

vi.mock('../map/DrawingTools', () => ({
  DrawingTools: () => <div>Drawing Tools</div>,
}));

vi.mock('../initiative/InitiativePanel', () => ({
  InitiativePanel: () => <div>Initiative Panel</div>,
}));

vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({
    leaveSession: vi.fn().mockResolvedValue(undefined),
    claimGM: vi.fn().mockResolvedValue({ success: true }),
    releaseGM: vi.fn().mockResolvedValue({ success: true }),
    loadChatData: vi.fn().mockResolvedValue(undefined),
    loadInitiativeData: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../../hooks/useMap', () => ({
  useMap: () => ({
    updateDrawingData: updateDrawingDataMock,
  }),
}));

vi.mock('../shared/Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

describe('PlaySession drawing mode', () => {
  beforeEach(() => {
    updateDrawingDataMock.mockClear();
    vi.stubGlobal('confirm', vi.fn(() => true));

    useSessionStore.setState({
      session: {
        id: 'session_001',
        code: 'ABCD12',
        name: 'Shared Table',
        activeMapId: 'map_001',
        currentGmUsername: 'GM',
        notepadContent: '',
        allowPlayersRenameNpcs: true,
        allowPlayersMoveNpcs: true,
        enableInitiativePhase: false,
        enablePlotDice: false,
        allowPlayersDrawings: true,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
      currentUser: {
        username: 'GM',
        characterId: null,
        isGm: true,
      },
      players: [],
      connectionStatus: 'connected',
    });

    useMapStore.setState({
      activeMap: {
        id: 'map_001',
        sessionId: 'session_001',
        name: 'Room One',
        imageUrl: '',
        width: 1000,
        height: 1000,
        sortOrder: 0,
        createdAt: '2026-04-01T00:00:00.000Z',
        gridEnabled: false,
        gridOffsetX: 0,
        gridOffsetY: 0,
        gridCellSize: 50,
        gridColor: '#000000',
        fogEnabled: false,
        fogDefaultState: 'revealed',
        fogData: [],
        drawingData: [],
        effectsEnabled: false,
        effectData: [],
        showPlayerTokens: true,
      },
      drawingData: [],
      drawingTool: null,
    });
  });

  it('turns off drawing mode when leaving the draw tab', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <PlaySession />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /draw/i }));
    useMapStore.getState().setDrawingTool('free');

    await user.click(screen.getByRole('button', { name: /chat/i }));

    expect(useMapStore.getState().drawingTool).toBeNull();
  });

  it('clears only the current player drawings from the draw tab clear action', async () => {
    const user = userEvent.setup();

    useSessionStore.setState({
      currentUser: {
        username: 'Kaladin',
        characterId: 'char_001',
        isGm: false,
      },
    });

    useMapStore.setState({
      drawingData: [
        {
          id: 'drawing_1',
          authorRole: 'player',
          authorUsername: 'Kaladin',
          shape: 'free',
          points: [{ x: 0, y: 0 }],
          strokeWidth: 4,
          color: '#000000',
          filled: false,
          createdAt: '2026-04-01T00:00:00.000Z',
        },
        {
          id: 'drawing_2',
          authorRole: 'player',
          authorUsername: 'Shallan',
          shape: 'free',
          points: [{ x: 1, y: 1 }],
          strokeWidth: 4,
          color: '#000000',
          filled: false,
          createdAt: '2026-04-01T00:00:00.000Z',
        },
        {
          id: 'drawing_3',
          authorRole: 'gm',
          authorUsername: 'GM',
          shape: 'free',
          points: [{ x: 2, y: 2 }],
          strokeWidth: 4,
          color: '#000000',
          filled: false,
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    });

    render(
      <MemoryRouter>
        <PlaySession />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /draw/i }));
    await user.click(screen.getByRole('button', { name: /^clear$/i }));

    expect(updateDrawingDataMock).toHaveBeenCalledWith('map_001', [
      expect.objectContaining({ id: 'drawing_2' }),
      expect.objectContaining({ id: 'drawing_3' }),
    ]);
  });

  it('keeps the draw tools panel larger and only enables scrolling on shorter viewports', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <PlaySession />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /draw/i }));

    const playerSidebar = screen.getByRole('button', { name: /chat/i }).closest('aside');
    const scrollArea = screen.getByTestId('draw-tools-scroll-area');

    expect(playerSidebar?.className).toContain('w-96');
    expect(playerSidebar?.className).not.toContain('w-[26rem]');
    expect(scrollArea.className).toContain('flex-1');
    expect(scrollArea.className).not.toContain('max-h-72');
    expect(scrollArea.className).toContain('[@media(max-height:900px)]:overflow-y-auto');
  });
});
