import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/play/PlaySession', () => ({
  PlaySession: () => <div>Play Session</div>,
}));

vi.mock('../../hooks/useRealtime', () => ({
  useRealtime: () => undefined,
}));

describe('/DunGEN route', () => {
  it('renders the DunGEN home shell', async () => {
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
      <MemoryRouter initialEntries={['/DunGEN']}>
        <App />
      </MemoryRouter>
    );

    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();

    expect(html).toContain('DunGEN Campaigns');
    expect(html).toContain('Create Campaign');
  });
});
