import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PlayRoute } from './PlayRoute';

const mockSessionState = vi.hoisted(() => ({
  session: null as null | { id: string; code: string; name: string },
  currentUser: null as null | { username: string; characterId: string | null; isGm: boolean },
}));

vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: (selector: (state: typeof mockSessionState) => unknown) => selector(mockSessionState),
}));

vi.mock('./PlaySession', () => ({
  PlaySession: () => <div>Play Session</div>,
}));

vi.mock('./PlayEntryHub', () => ({
  PlayEntryHub: () => <div>Play Entry Hub</div>,
}));

vi.mock('./PlayAutoJoinGate', () => ({
  PlayAutoJoinGate: () => <div>Play Auto Join</div>,
}));

describe('PlayRoute', () => {
  it('renders the public entry hub when no session is active', () => {
    mockSessionState.session = null;
    mockSessionState.currentUser = null;

    const html = renderToString(
      <MemoryRouter initialEntries={['/play']}>
        <PlayRoute />
      </MemoryRouter>
    );

    expect(html).toContain('Play Entry Hub');
  });

  it('renders the live play session when both session and current user exist', () => {
    mockSessionState.session = {
      id: 'session_001',
      code: 'ABCD-1234',
      name: 'Stormlight Night',
    };
    mockSessionState.currentUser = {
      username: 'Kaladin',
      characterId: null,
      isGm: true,
    };

    const html = renderToString(
      <MemoryRouter initialEntries={['/play']}>
        <PlayRoute />
      </MemoryRouter>
    );

    expect(html).toContain('Play Session');
  });

  it('renders the auto-join gate when launch parameters are present without an active session', () => {
    mockSessionState.session = null;
    mockSessionState.currentUser = null;

    const html = renderToString(
      <MemoryRouter initialEntries={['/play?autojoin=1&code=ABCD12&username=Ryan']}>
        <PlayRoute />
      </MemoryRouter>
    );

    expect(html).toContain('Play Auto Join');
  });

  it('ignores the legacy launching flag when no session is active', () => {
    mockSessionState.session = null;
    mockSessionState.currentUser = null;

    const html = renderToString(
      <MemoryRouter initialEntries={['/play?launching=1']}>
        <PlayRoute />
      </MemoryRouter>
    );

    expect(html).toContain('Play Entry Hub');
  });

  it('prioritizes launch auto-join over a previously persisted session', () => {
    mockSessionState.session = {
      id: 'session_old',
      code: 'OLD123',
      name: 'Old Session',
    };
    mockSessionState.currentUser = {
      username: 'Ryan',
      characterId: null,
      isGm: true,
    };

    const html = renderToString(
      <MemoryRouter initialEntries={['/play?autojoin=1&code=NEW456&username=Ryan']}>
        <PlayRoute />
      </MemoryRouter>
    );

    expect(html).toContain('Play Auto Join');
    expect(html).not.toContain('Play Session');
  });

  it('shows the live session once the auto-join target is already active in session state', () => {
    mockSessionState.session = {
      id: 'session_new',
      code: 'NEW456',
      name: 'New Session',
    };
    mockSessionState.currentUser = {
      username: 'Ryan',
      characterId: null,
      isGm: true,
    };

    const html = renderToString(
      <MemoryRouter initialEntries={['/play?autojoin=1&code=NEW456&username=Ryan']}>
        <PlayRoute />
      </MemoryRouter>
    );

    expect(html).toContain('Play Session');
    expect(html).not.toContain('Play Auto Join');
  });

  it('ignores the legacy launching flag when a session is already active', () => {
    mockSessionState.session = {
      id: 'session_old',
      code: 'OLD123',
      name: 'Old Session',
    };
    mockSessionState.currentUser = {
      username: 'Ryan',
      characterId: null,
      isGm: true,
    };

    const html = renderToString(
      <MemoryRouter initialEntries={['/play?launching=1']}>
        <PlayRoute />
      </MemoryRouter>
    );

    expect(html).toContain('Play Session');
  });
});
