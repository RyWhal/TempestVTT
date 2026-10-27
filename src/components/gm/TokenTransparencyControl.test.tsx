/* @vitest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '../../stores/sessionStore';
import type { Session } from '../../types';
import { TokenTransparencyControl } from './TokenTransparencyControl';

const mocks = vi.hoisted(() => ({ save: vi.fn(), toast: vi.fn() }));
vi.mock('../../hooks/useSession', () => ({ useSession: () => ({ updateSessionSettings: mocks.save }) }));
vi.mock('../shared/Toast', () => ({ useToast: () => ({ showToast: mocks.toast }) }));
beforeEach(() => {
  mocks.save.mockReset(); mocks.toast.mockReset();
  useSessionStore.setState({ session: { id: 'table', tokenOpacity: 1 } as Session, currentUser: { username: 'GM', characterId: null, isGm: true } });
  mocks.save.mockImplementation(async ({ tokenOpacity }: { tokenOpacity: number }) => {
    useSessionStore.getState().updateSession({ tokenOpacity });
    return { success: true };
  });
});
describe('shared transparency control', () => {
  it.each([[0, 1], [50, 0.5], [100, 0]])('saves %s percent transparency as opacity %s on release', async (value, tokenOpacity) => {
    useSessionStore.getState().updateSession({ tokenOpacity: 0.25 });
    render(<TokenTransparencyControl />);
    const slider = screen.getByRole('slider', { name: 'Token name transparency' });
    fireEvent.change(slider, { target: { value: String(value) } });
    expect(mocks.save).not.toHaveBeenCalled();
    await act(async () => { fireEvent.pointerUp(slider); });
    expect(mocks.save).toHaveBeenCalledWith({ tokenOpacity });
    expect((slider as HTMLInputElement).value).toBe(String(value));
  });

  it('deduplicates release/blur while a save is pending and restores after failure', async () => {
    let finish!: (value: { success: boolean; error: string }) => void;
    mocks.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<TokenTransparencyControl />);
    const slider = screen.getByRole('slider', { name: 'Token name transparency' });
    fireEvent.change(slider, { target: { value: '50' } });
    fireEvent.pointerUp(slider); fireEvent.blur(slider);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(slider.hasAttribute('disabled')).toBe(true);
    await act(async () => { finish({ success: false, error: 'Network unavailable' }); });
    expect((slider as HTMLInputElement).value).toBe('0');
    expect(slider.hasAttribute('disabled')).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith('Network unavailable', 'error');
  });

  it('supports keyboard saves and reflects remote session updates', async () => {
    render(<TokenTransparencyControl />);
    const slider = screen.getByRole('slider', { name: 'Token name transparency' });
    fireEvent.change(slider, { target: { value: '100' } });
    await act(async () => { fireEvent.keyUp(slider, { key: 'End' }); });
    expect(mocks.save).toHaveBeenCalledWith({ tokenOpacity: 0 });
    act(() => useSessionStore.getState().updateSession({ tokenOpacity: 0.6 }));
    expect((slider as HTMLInputElement).value).toBe('40');
  });

  it('does not expose the control to a non-GM', () => {
    useSessionStore.setState({ currentUser: { username: 'Player', characterId: null, isGm: false } });
    render(<TokenTransparencyControl />);
    expect(screen.queryByRole('slider')).toBeNull();
  });
});
