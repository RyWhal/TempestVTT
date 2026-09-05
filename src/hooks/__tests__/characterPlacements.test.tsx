/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCharacters } from '../useCharacters';
import { useSession } from '../useSession';
import { useMapStore } from '../../stores/mapStore';
import { useSessionStore } from '../../stores/sessionStore';
import { applyCharacterPlacement, type CharacterPlacement } from '../../lib/characterPlacement';
import type { Character, Map, Session } from '../../types';

const { rows, upsert, from } = vi.hoisted(() => ({
  rows: [] as CharacterPlacement[], upsert: vi.fn(), from: vi.fn(),
}));
vi.mock('../../lib/supabase', () => ({
  supabase: { from }, uploadFile: vi.fn(), deleteFile: vi.fn(), STORAGE_BUCKETS: {},
}));

const character = { id: 'pc', sessionId: 'session', name: 'Kaladin', notes: 'Keep me', inventory: [{ name: 'Spear' }], positionX: 0, positionY: 0 } as Character;
const mapA = { id: 'a', sessionId: 'session', drawingData: [], width: 500, height: 500 } as unknown as Map;
const mapB = { ...mapA, id: 'b' };

describe('durable per-map PC placement', () => {
  beforeEach(() => {
    rows.length = 0;
    upsert.mockReset(); from.mockReset();
    useMapStore.getState().clearMapState();
    useSessionStore.setState({ session: { id: 'session' } as Session, currentUser: { username: 'GM', characterId: null, isGm: true } });
    useMapStore.setState({ maps: [mapA, mapB], activeMap: mapA, characters: [character] });
    upsert.mockImplementation(async (row: CharacterPlacement) => {
      const index = rows.findIndex((r) => r.map_id === row.map_id && r.character_id === row.character_id);
      if (index < 0) rows.push(row); else rows[index] = row;
      return { error: null };
    });
    from.mockImplementation((table: string) => {
      if (table === 'character_map_placements') return { upsert, select: () => ({ eq: async () => ({ data: rows, error: null }) }) };
      if (table === 'maps') return { select: () => ({ eq: () => ({ order: async () => ({ data: [mapA, mapB].map((map) => ({ ...map, session_id: 'session', drawing_data: [] })) }) }) }) };
      if (table === 'sessions') return { select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'session', active_map_id: 'a' } }) }) }) };
      if (table === 'characters') return { select: () => ({ eq: async () => ({ data: [{ ...character, session_id: 'session', position_x: 0, position_y: 0 }] }) }) };
      if (table === 'npc_instances') return { select: () => ({ in: async () => ({ data: [] }) }) };
      if (table === 'session_players') return { select: () => ({ eq: async () => ({ data: [] }) }) };
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('restores independent placements through the real session hydration path after a refresh', async () => {
    const { result } = renderHook(() => ({ characters: useCharacters(), session: useSession() }));
    await act(async () => {
      await result.current.characters.moveCharacterPosition('pc', 10, 20, 'a');
      await result.current.characters.moveCharacterPosition('pc', 80, 90, 'b');
    });
    act(() => useMapStore.getState().clearMapState());
    await act(async () => { await result.current.session.loadSessionData('session'); });
    expect(useMapStore.getState().tokenPositionsByMap.a.characters.pc).toEqual({ x: 10, y: 20 });
    expect(useMapStore.getState().tokenPositionsByMap.b.characters.pc).toEqual({ x: 80, y: 90 });
    expect(useMapStore.getState().characters[0].positionX).toBe(10);
  });

  it('removes only one map placement and preserves the character and other map on reload', async () => {
    const { result } = renderHook(() => ({ characters: useCharacters(), session: useSession() }));
    await act(async () => {
      await result.current.characters.moveCharacterPosition('pc', 10, 20, 'a');
      await result.current.characters.moveCharacterPosition('pc', 80, 90, 'b');
      await result.current.characters.removeCharacterFromMap('pc', 'a');
      await result.current.session.loadSessionData('session');
    });
    expect(useMapStore.getState().tokenPositionsByMap.a?.characters.pc).toBeUndefined();
    expect(useMapStore.getState().tokenPositionsByMap.b.characters.pc).toEqual({ x: 80, y: 90 });
    expect(useMapStore.getState().characters[0]).toMatchObject({ id: 'pc', notes: 'Keep me', inventory: [{ name: 'Spear' }] });
    expect(rows.find((row) => row.map_id === 'a')?.is_placed).toBe(false);
  });

  it('keeps the previous placement when persistence fails', async () => {
    const { result } = renderHook(() => useCharacters());
    await act(async () => { await result.current.moveCharacterPosition('pc', 10, 20); });
    upsert.mockResolvedValueOnce({ error: { message: 'offline' } });
    await act(async () => { expect(await result.current.removeCharacterFromMap('pc')).toEqual({ success: false, error: 'offline' }); });
    expect(useMapStore.getState().tokenPositionsByMap.a.characters.pc).toEqual({ x: 10, y: 20 });
  });

  it('serializes move/remove so a delayed move cannot restore a removed token', async () => {
    let release!: () => void;
    upsert.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ error: null }); }));
    const { result } = renderHook(() => useCharacters());
    await act(async () => {
      const move = result.current.moveCharacterPosition('pc', 10, 20);
      const remove = result.current.removeCharacterFromMap('pc');
      await Promise.resolve(); await Promise.resolve();
      expect(upsert).toHaveBeenCalledTimes(1);
      release();
      await Promise.all([move, remove]);
    });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(useMapStore.getState().tokenPositionsByMap.a.characters.pc).toBeUndefined();
  });

  it('applies remote placement and removal without moving a PC on a different active map', () => {
    applyCharacterPlacement({ session_id: 'session', map_id: 'b', character_id: 'pc', position_x: 55, position_y: 60, is_placed: true });
    expect(useMapStore.getState().characters[0].positionX).toBe(0);
    act(() => useMapStore.getState().setActiveMap(mapB));
    expect(useMapStore.getState().characters[0].positionX).toBe(55);
    applyCharacterPlacement({ session_id: 'session', map_id: 'b', character_id: 'pc', position_x: 0, position_y: 0, is_placed: false });
    expect(useMapStore.getState().tokenPositionsByMap.b.characters.pc).toBeUndefined();
  });
});
