import type { MapBakeArtifactWriter } from './SemanticMapTypes';

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const stringToBase64 = (value: string): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf-8').toString('base64');
  }

  return btoa(unescape(encodeURIComponent(value)));
};

const toDataUrl = (body: string, contentType: string) =>
  `data:${contentType};base64,${stringToBase64(body)}`;

const isLocalBrowserRuntime = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const resolveAssetProxyUrl = (url: string) => {
  if (typeof window === 'undefined') {
    return url;
  }

  if (!isLocalBrowserRuntime()) {
    return url;
  }

  return `${window.location.origin}/__r2_asset_proxy?url=${encodeURIComponent(url)}`;
};

const toBlobUrl = (body: string, contentType: string) => {
  if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return toDataUrl(body, contentType);
  }

  return URL.createObjectURL(new Blob([body], { type: contentType }));
};

const inlineSvgImageHrefs = async (body: string): Promise<string> => {
  const hrefPattern = /href="([^"]+)"/g;
  const matches = [...body.matchAll(hrefPattern)];
  const remoteUrls = [...new Set(matches.map((match) => match[1]).filter((url) => /^https?:\/\//.test(url)))];

  if (remoteUrls.length === 0) {
    return body;
  }

  const dataUrlBySource = new Map<string, string>();

  await Promise.all(
    remoteUrls.map(async (url) => {
      try {
        const response = await fetch(resolveAssetProxyUrl(url));
        if (!response.ok) {
          return;
        }

        const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
        const base64 = arrayBufferToBase64(await response.arrayBuffer());
        dataUrlBySource.set(url, `data:${contentType};base64,${base64}`);
      } catch {
        // Leave the original href in place if the asset fetch fails.
      }
    })
  );

  return body.replace(hrefPattern, (fullMatch, href: string) => {
    const dataUrl = dataUrlBySource.get(href);
    return dataUrl ? `href="${dataUrl}"` : fullMatch;
  });
};

export const createInlineArtifactWriter = (): MapBakeArtifactWriter => ({
  async writeArtifact({ path, body, contentType }) {
    if (contentType === 'image/svg+xml' && isLocalBrowserRuntime()) {
      const resolvedBody = await inlineSvgImageHrefs(body);
      return {
        path,
        publicUrl: toBlobUrl(resolvedBody, contentType),
      };
    }

    const resolvedBody =
      contentType === 'image/svg+xml' ? await inlineSvgImageHrefs(body) : body;

    return {
      path,
      publicUrl: toDataUrl(resolvedBody, contentType),
    };
  },
});
