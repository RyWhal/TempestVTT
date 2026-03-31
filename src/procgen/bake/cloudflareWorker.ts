import { loadMapBakeContent } from './AssetRegistryLoader';
import { createCloudflareR2Writer, type CloudflareR2ObjectStore } from './cloudflareR2Writer';
import { createMapBakeOrchestrator } from './MapBakeOrchestrator';
import type { GeneratedSemanticMap, MapBakeArtifactWriter, MapBakeJobState } from './SemanticMapTypes';

export interface MapBakeWorkerRequest {
  semanticMap: GeneratedSemanticMap;
  previousState: MapBakeJobState | null;
  maxChunksPerInvocation?: number;
}

export interface CloudflareMapBakeEnv {
  FLOOR_BAKE_BUCKET: CloudflareR2ObjectStore;
  FLOOR_BAKE_PUBLIC_BASE_URL: string;
}

export const createMapBakeWorkerHandler = (artifactWriter: MapBakeArtifactWriter) => {
  const orchestrator = createMapBakeOrchestrator({
    content: loadMapBakeContent(),
    artifactWriter,
  });

  return {
    async handle(request: MapBakeWorkerRequest) {
      return orchestrator.runBake({
        semanticMap: request.semanticMap,
        previousState: request.previousState,
        maxChunksPerInvocation: request.maxChunksPerInvocation ?? 2,
      });
    },
  };
};

export const createCloudflareMapBakeWorker = (env: CloudflareMapBakeEnv) =>
  createMapBakeWorkerHandler(
    createCloudflareR2Writer({
      bucket: env.FLOOR_BAKE_BUCKET,
      publicBaseUrl: env.FLOOR_BAKE_PUBLIC_BASE_URL,
    })
  );
