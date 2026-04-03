/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NPCManager } from './NPCManager';

vi.mock('../../hooks/useNPCs', () => ({
  useNPCs: () => ({
    npcTemplates: [
      {
        id: 'template_1',
        sessionId: 'session_001',
        name: 'Goblin Scout',
        tokenUrl: 'https://example.com/goblin-scout.png',
        defaultSize: 'small',
        notes: '',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'template_2',
        sessionId: 'session_001',
        name: 'Goblin Archer',
        tokenUrl: 'https://example.com/goblin-archer.png',
        defaultSize: 'small',
        notes: '',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'template_3',
        sessionId: 'session_001',
        name: 'Goblin Boss',
        tokenUrl: 'https://example.com/goblin-boss.png',
        defaultSize: 'medium',
        notes: '',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'template_4',
        sessionId: 'session_001',
        name: 'Goblin Shaman',
        tokenUrl: 'https://example.com/goblin-shaman.png',
        defaultSize: 'small',
        notes: '',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'template_5',
        sessionId: 'session_001',
        name: 'Goblin Brute',
        tokenUrl: 'https://example.com/goblin-brute.png',
        defaultSize: 'large',
        notes: '',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ],
    currentMapNPCs: [
      {
        id: 'npc_1',
        mapId: 'map_001',
        templateId: 'template_1',
        displayName: 'Goblin Scout-1',
        tokenUrl: 'https://example.com/goblin-scout-1.png',
        size: 'small',
        statusRingColor: null,
        positionX: 10,
        positionY: 10,
        isVisible: true,
        notes: '',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'npc_2',
        mapId: 'map_001',
        templateId: 'template_2',
        displayName: 'Goblin Archer-1',
        tokenUrl: 'https://example.com/goblin-archer-1.png',
        size: 'small',
        statusRingColor: null,
        positionX: 15,
        positionY: 15,
        isVisible: true,
        notes: '',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'npc_3',
        mapId: 'map_001',
        templateId: 'template_3',
        displayName: 'Goblin Boss-1',
        tokenUrl: 'https://example.com/goblin-boss-1.png',
        size: 'medium',
        statusRingColor: null,
        positionX: 20,
        positionY: 20,
        isVisible: true,
        notes: '',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'npc_4',
        mapId: 'map_001',
        templateId: 'template_4',
        displayName: 'Goblin Shaman-1',
        tokenUrl: 'https://example.com/goblin-shaman-1.png',
        size: 'small',
        statusRingColor: null,
        positionX: 25,
        positionY: 25,
        isVisible: true,
        notes: '',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'npc_5',
        mapId: 'map_001',
        templateId: 'template_5',
        displayName: 'Goblin Brute-1',
        tokenUrl: 'https://example.com/goblin-brute-1.png',
        size: 'large',
        statusRingColor: null,
        positionX: 30,
        positionY: 30,
        isVisible: true,
        notes: '',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ],
    createNPCTemplate: vi.fn(),
    deleteNPCTemplate: vi.fn(),
    addNPCToMap: vi.fn(),
    toggleNPCVisibility: vi.fn(),
    removeNPCFromMap: vi.fn(),
    updateNPCInstanceDetails: vi.fn(),
  }),
}));

vi.mock('../../stores/mapStore', () => ({
  useMapStore: (selector: (state: any) => unknown) =>
    selector({
      activeMap: {
        id: 'map_001',
      },
      viewportScale: 1,
      stageWidth: 800,
      stageHeight: 600,
      selectToken: vi.fn(),
      setViewportPosition: vi.fn(),
    }),
}));

vi.mock('../shared/Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('./GlobalAssetBrowser', () => ({
  GlobalAssetBrowser: () => <div>Global Asset Browser</div>,
}));

describe('NPCManager', () => {
  it('uses preview cards to open the library and active-map NPC pop-ups', async () => {
    const user = userEvent.setup();

    render(<NPCManager />);

    expect(screen.queryByRole('button', { name: /view library/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /view active npcs/i })).toBeNull();
    expect(screen.getAllByRole('img')).toHaveLength(8);
    expect(screen.getAllByText('+1')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /^open npc library$/i }));
    expect(screen.getByText('Goblin Scout')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /^open active npcs$/i }));
    expect(screen.getByDisplayValue('Goblin Scout-1')).not.toBeNull();
  });
});
