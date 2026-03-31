import type { MapBakeArtifactWriter } from './SemanticMapTypes';

export interface CloudflareR2ObjectStore {
  put(
    key: string,
    value: string,
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
    }
  ): Promise<void>;
}

export const createCloudflareR2Writer = ({
  bucket,
  publicBaseUrl,
}: {
  bucket: CloudflareR2ObjectStore;
  publicBaseUrl: string;
}): MapBakeArtifactWriter => ({
  async writeArtifact({ path, body, contentType }) {
    await bucket.put(path, body, {
      httpMetadata: {
        contentType,
      },
    });

    return {
      path,
      publicUrl: `${publicBaseUrl.replace(/\/$/, '')}/${path}`,
    };
  },
});
