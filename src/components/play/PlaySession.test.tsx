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

describe('PlaySession modern layout', () => {
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
        allowPlayersRenamePcs: true,
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
      maps: [
        {
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
          tokenSizeOverrideEnabled: false,
          mediumTokenSizePx: null,
          fogEnabled: false,
          fogDefaultState: 'revealed',
          fogData: [],
          drawingData: [],
          effectsEnabled: false,
          effectData: [],
          showPlayerTokens: true,
        },
      ],
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
        tokenSizeOverrideEnabled: false,
        mediumTokenSizePx: null,
        fogEnabled: false,
        fogDefaultState: 'revealed',
        fogData: [],
        drawingData: [],
        effectsEnabled: false,
        effectData: [],
        showPlayerTokens: true,
      },
      characters: [],
      npcTemplates: [],
      npcInstances: [],
      drawingData: [],
      drawingTool: null,
    });
  });

  it('renders the left toolbar and opens Token Hub by default', async () => {
    render(
      <MemoryRouter>
        <PlaySession />
      </MemoryRouter>
    );

    expect(screen.getByText('Players & Tokens')).not.toBeNull();
  });

  it('allows switching to Chat and Dice panels via the left toolbar', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <PlaySession />
      </MemoryRouter>
    );

    const chatButton = screen.getByTitle('Chat Log');
    await user.click(chatButton);
    expect(screen.getByText('Chat Panel')).not.toBeNull();

    const diceButton = screen.getByTitle('Dice Roller');
    await user.click(diceButton);
    expect(screen.getByText('Dice Panel')).not.toBeNull();
  });
});
