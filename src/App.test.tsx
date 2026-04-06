/* @vitest-environment jsdom */

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/shared/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./components/session/Home', () => ({
  Home: () => <div>Home</div>,
}));

vi.mock('./components/session/SessionCreate', () => ({
  SessionCreate: () => <div>Create</div>,
}));

vi.mock('./components/session/SessionJoin', () => ({
  SessionJoin: () => <div>Join</div>,
}));

vi.mock('./components/session/SessionLobby', () => ({
  SessionLobby: () => <div>Lobby</div>,
}));

vi.mock('./components/session/LegacyRouteAlias', () => ({
  LegacyRouteAlias: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./components/play/PlayRoute', () => ({
  PlayRoute: () => {
    throw new Promise(() => {});
  },
}));

vi.mock('./components/admin/AdminLogin', () => ({
  AdminLogin: () => <div>Admin Login</div>,
}));

vi.mock('./components/admin/AdminDashboard', () => ({
  AdminDashboard: () => <div>Admin Dashboard</div>,
}));

vi.mock('./components/admin/AssetCreate', () => ({
  AssetCreate: () => <div>Asset Create</div>,
}));

vi.mock('./stores/sessionStore', () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      session: null,
      currentUser: null,
      clearSession: vi.fn(),
      setCurrentUser: vi.fn(),
    }),
}));

vi.mock('./hooks/useSession', () => ({
  useSession: () => ({
    joinSession: vi.fn().mockResolvedValue({ success: true }),
    loadSessionData: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('./hooks/useRealtime', () => ({
  useRealtime: vi.fn(),
}));

vi.mock('./lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('App route loading', () => {
  it('shows a loading fallback while a route is suspending', async () => {
    await act(async () => {
      render(
        <MemoryRouter
          initialEntries={['/play']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <App />
        </MemoryRouter>
      );
      await Promise.resolve();
    });

    expect(screen.getByText(/loading tempest table/i)).toBeTruthy();
  });
});
