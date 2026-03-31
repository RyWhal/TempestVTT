import { describe, expect, it, vi, afterEach } from 'vitest';
import { createInlineArtifactWriter } from '../bake/inlineArtifactWriter';

const decodeDataUrlBody = (dataUrl: string) => {
  if (dataUrl.includes(';base64,')) {
    const [, body = ''] = dataUrl.split(',', 2);
    return Buffer.from(body, 'base64').toString('utf-8');
  }

  const [, body = ''] = dataUrl.split(',', 2);
  return decodeURIComponent(body);
};

describe('inlineArtifactWriter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('inlines external svg image references into embedded data urls', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('one.png')) {
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'Content-Type': 'image/png' },
        });
      }

      return new Response(new Uint8Array([4, 5, 6]), {
        headers: { 'Content-Type': 'image/webp' },
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const writer = createInlineArtifactWriter();
    const result = await writer.writeArtifact({
      path: 'generated-floor/test/chunk.svg',
      contentType: 'image/svg+xml',
      body: [
        '<svg xmlns="http://www.w3.org/2000/svg">',
        '<image href="https://assets.example.com/one.png" />',
        '<image href="https://assets.example.com/one.png" />',
        '<image href="https://assets.example.com/two.webp" />',
        '</svg>',
      ].join(''),
    });

    const inlinedSvg = decodeDataUrlBody(result.publicUrl);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(inlinedSvg).toContain('href="data:image/png;base64,');
    expect(inlinedSvg).toContain('href="data:image/webp;base64,');
    expect(inlinedSvg).not.toContain('https://assets.example.com/one.png');
    expect(inlinedSvg).not.toContain('https://assets.example.com/two.webp');
  });

  it('routes asset fetches through the local proxy on localhost and returns a blob url', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe(
        'http://localhost:5173/__r2_asset_proxy?url=https%3A%2F%2Fassets.example.com%2Fone.png'
      );

      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'image/png' },
      });
    });
    const createObjectURLMock = vi.fn((blob: Blob) => {
      expect(blob.type).toBe('image/svg+xml');
      return 'blob:generated-chunk';
    });

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:5173',
        hostname: 'localhost',
      },
    } as Window & typeof globalThis);
    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLMock,
    } as unknown as typeof URL);

    const writer = createInlineArtifactWriter();
    const result = await writer.writeArtifact({
      path: 'generated-floor/test/chunk.svg',
      contentType: 'image/svg+xml',
      body: [
        '<svg xmlns="http://www.w3.org/2000/svg">',
        '<image href="https://assets.example.com/one.png" />',
        '</svg>',
      ].join(''),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(result.publicUrl).toBe('blob:generated-chunk');
  });
});
