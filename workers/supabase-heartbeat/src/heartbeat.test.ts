// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { recordProjectHeartbeat } from './heartbeat';

describe('recordProjectHeartbeat', () => {
  it('rejects missing configuration before making a request', async () => {
    const fetchMock = vi.fn<typeof fetch>();

    await expect(
      recordProjectHeartbeat(
        { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' },
        { fetch: fetchMock }
      )
    ).rejects.toThrow('Supabase heartbeat configuration is incomplete');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls the heartbeat RPC and returns its validated result', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([{ last_seen_at: '2026-08-12T14:00:00.000Z', run_count: 7 }]),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await expect(
      recordProjectHeartbeat(
        { SUPABASE_URL: 'https://example.supabase.co/', SUPABASE_ANON_KEY: 'secret-anon-key' },
        { fetch: fetchMock }
      )
    ).resolves.toEqual({
      lastSeenAt: '2026-08-12T14:00:00.000Z',
      runCount: 7,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/rpc/app_record_project_heartbeat',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('reports a bounded remote error and redacts an echoed credential', async () => {
    const secret = 'secret-anon-key';
    const responseBody = `upstream echoed ${secret} ${'x'.repeat(600)}`;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(responseBody, { status: 401 }));

    const error = await recordProjectHeartbeat(
      { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: secret },
      { fetch: fetchMock }
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('HTTP 401');
    expect((error as Error).message).toContain('[REDACTED]');
    expect((error as Error).message).not.toContain(secret);
    expect((error as Error).message.length).toBeLessThan(600);
  });

  it.each([
    [[]],
    [[
      { last_seen_at: '2026-08-12T14:00:00.000Z', run_count: 1 },
      { last_seen_at: '2026-08-12T14:00:01.000Z', run_count: 2 },
    ]],
    [[{ last_seen_at: 'not-a-date', run_count: 1 }]],
    [[{ last_seen_at: '2026-08-12T14:00:00.000Z', run_count: 1.5 }]],
    [[{ last_seen_at: '2026-08-12T14:00:00.000Z', run_count: -1 }]],
  ])('rejects an invalid RPC payload: %j', async (payload) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    await expect(
      recordProjectHeartbeat(
        { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'secret' },
        { fetch: fetchMock }
      )
    ).rejects.toThrow('invalid response');
  });

  it('rejects malformed JSON', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{', { status: 200 }));

    await expect(
      recordProjectHeartbeat(
        { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'secret' },
        { fetch: fetchMock }
      )
    ).rejects.toThrow('malformed JSON');
  });

  it('propagates a network failure without exposing the credential', async () => {
    const secret = 'secret-anon-key';
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error('request timed out'));

    const error = await recordProjectHeartbeat(
      { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: secret },
      { fetch: fetchMock, timeoutMs: 1 }
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('timed out');
    expect((error as Error).message).not.toContain(secret);
  });
});
