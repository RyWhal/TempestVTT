/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenPopover } from './TokenPopover';
import { useMapStore } from '../../stores/mapStore';
import { formatNPCHp, parseNPCHp } from '../../lib/npcHp';
import type { Character } from '../../types';

const mocks = vi.hoisted(() => ({ update: vi.fn(), remove: vi.fn(), deleteCharacter: vi.fn(), toast: vi.fn() }));
vi.mock('../../hooks/useCharacters', () => ({ useCharacters: () => ({ updateCharacterDetails: mocks.update, removeCharacterFromMap: mocks.remove, deleteCharacter: mocks.deleteCharacter }) }));
vi.mock('../../hooks/useNPCs', () => ({ useNPCs: () => ({ updateNPCInstanceDetails: vi.fn(), removeNPCFromMap: vi.fn() }) }));
vi.mock('../../hooks/useInitiative', () => ({ useInitiative: () => ({ entries: [], setPhaseForParticipant: vi.fn() }) }));
vi.mock('../../stores/sessionStore', () => ({ useIsGM: () => true, useSessionStore: (selector: (state: unknown) => unknown) => selector({ currentUser: { username: 'GM' }, session: {} }) }));
vi.mock('../shared/Toast', () => ({ useToast: () => ({ showToast: mocks.toast }) }));

const character = (id: string, name: string): Character => ({ id, name, sessionId: 'session', tokenUrl: null, size: 'medium', statusRingColor: null, positionX: 100, positionY: 100, isClaimed: false, claimedByUsername: null, inventory: [], notes: formatNPCHp(20, 30, 'Original notes'), createdAt: '' });

describe('TokenPopover persistence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useMapStore.setState({ characters: [character('a', 'Kaladin'), character('b', 'Shallan')], selectedTokenId: 'a', selectedTokenType: 'character' });
    mocks.remove.mockResolvedValue({ success: true });
    mocks.update.mockImplementation(async (id: string, patch: Partial<Character>) => {
      useMapStore.getState().updateCharacter(id, patch);
      return { success: true };
    });
  });
  afterEach(cleanup);

  it('removes a PC from the map without deleting the character', async () => {
    render(<TokenPopover />);
    fireEvent.click(screen.getByTitle('Remove from map'));
    await waitFor(() => expect(useMapStore.getState().selectedTokenId).toBeNull());
    expect(mocks.remove).toHaveBeenCalledWith('a');
    expect(mocks.deleteCharacter).not.toHaveBeenCalled();
  });

  it('retains selection and reports a failed removal', async () => {
    mocks.remove.mockResolvedValue({ success: false, error: 'Offline' });
    render(<TokenPopover />);
    fireEvent.click(screen.getByTitle('Remove from map'));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith('Offline', 'error'));
    expect(useMapStore.getState().selectedTokenId).toBe('a');
  });

  it('refreshes the name draft when selection changes', () => {
    render(<TokenPopover />);
    fireEvent.change(screen.getByDisplayValue('Kaladin'), { target: { value: 'Uncommitted' } });
    act(() => useMapStore.getState().selectToken('b', 'character'));
    expect(screen.getByDisplayValue('Shallan')).toBeTruthy();
    expect(screen.queryByDisplayValue('Uncommitted')).toBeNull();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('commits Enter renames once through blur', async () => {
    render(<TokenPopover />);
    const input = screen.getByDisplayValue('Kaladin');
    input.focus();
    fireEvent.change(input, { target: { value: 'Stormblessed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenCalledWith('a', { name: 'Stormblessed' });
  });

  it('keeps HP typing local until blur and preserves notes changed meanwhile', async () => {
    render(<TokenPopover />);
    const input = screen.getByTitle('Current HP');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.change(input, { target: { value: '15' } });
    expect(mocks.update).not.toHaveBeenCalled();
    act(() => useMapStore.getState().updateCharacter('a', { notes: formatNPCHp(20, 40, 'New remote notes') }));
    fireEvent.blur(input);
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(parseNPCHp(mocks.update.mock.calls[0][1].notes)).toEqual({ hp: 15, maxHp: 40, notes: 'New remote notes' });
  });

  it('serializes rapid adjustments against the latest store HP and notes', async () => {
    let finishFirst!: () => void;
    mocks.update.mockImplementationOnce(async (id: string, patch: Partial<Character>) => {
      await new Promise<void>((resolve) => { finishFirst = resolve; });
      useMapStore.getState().updateCharacter(id, { ...patch, notes: formatNPCHp(21, 35, 'Concurrent notes') });
      return { success: true };
    });
    render(<TokenPopover />);
    fireEvent.click(screen.getByRole('button', { name: '+1' }));
    fireEvent.click(screen.getByRole('button', { name: '-5' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(parseNPCHp(mocks.update.mock.calls[0][1].notes).hp).toBe(21);
    await act(async () => finishFirst());
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));
    expect(parseNPCHp(mocks.update.mock.calls[1][1].notes)).toEqual({ hp: 16, maxHp: 35, notes: 'Concurrent notes' });
  });
});
