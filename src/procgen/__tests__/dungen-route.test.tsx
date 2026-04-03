import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/play/PlaySession', () => ({
  PlaySession: () => <div>Play Session</div>,
}));

vi.mock('../../hooks/useRealtime', () => ({
  useRealtime: () => undefined,
}));

describe('route split', () => {
  it('renders the new home chooser copy on /', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((message?: unknown) => {
        if (
          typeof message === 'string' &&
          message.includes('useLayoutEffect does nothing on the server')
        ) {
          return;
        }
      });
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation((message?: unknown) => {
        if (
          typeof message === 'string' &&
          message.includes('Supabase credentials not configured')
        ) {
          return;
        }
      });
    const { default: App } = await import('../../App');

    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();

    expect(html).toContain('Start Tempest Table');
    expect(html).toContain('Join a Table');
    expect(html).not.toContain('Start Endless Dungeon');
  });

  it('renders the public Tempest Table hub on /play when no session is active', async () => {
    const { default: App } = await import('../../App');

    const html = renderToString(
      <MemoryRouter initialEntries={['/play']}>
        <App />
      </MemoryRouter>
    );

    expect(html).toContain('Tempest Table');
    expect(html).toContain('Start a session');
    expect(html).toContain('Join with code');
  });

  it('does not expose Endless Dungeon on /campaign', async () => {
    const { default: App } = await import('../../App');

    const html = renderToString(
      <MemoryRouter initialEntries={['/campaign']}>
        <App />
      </MemoryRouter>
    );

    expect(html).not.toContain('Endless Dungeon');
  });

  it('removes the legacy DunGEN alias while keeping create and join routes', async () => {
    const { default: App } = await import('../../App');

    const dungenHtml = renderToString(
      <MemoryRouter initialEntries={['/DunGEN']}>
        <App />
      </MemoryRouter>
    );
    const createHtml = renderToString(
      <MemoryRouter initialEntries={['/create']}>
        <App />
      </MemoryRouter>
    );
    const joinHtml = renderToString(
      <MemoryRouter initialEntries={['/join']}>
        <App />
      </MemoryRouter>
    );

    expect(dungenHtml).not.toContain('Endless Dungeon');
    expect(createHtml).toContain('Create Session');
    expect(joinHtml).toContain('Join Session');
  });
});
