import { loadMapBakeContent, loadMapBakeSampleSemanticMap } from './AssetRegistryLoader';
import { createMapBakeOrchestrator } from './MapBakeOrchestrator';

export const runSampleBakeJob = async () => {
  const writes: Array<{ path: string; body: string; contentType: string }> = [];
  const orchestrator = createMapBakeOrchestrator({
    content: loadMapBakeContent(),
    artifactWriter: {
      async writeArtifact({ path, body, contentType }) {
        writes.push({ path, body, contentType });

        return {
          path,
          publicUrl: `https://r2.example.com/${path}`,
        };
      },
    },
  });

  const result = await orchestrator.runBake({
    semanticMap: loadMapBakeSampleSemanticMap(),
    previousState: null,
    maxChunksPerInvocation: 8,
  });

  return {
    result,
    writes,
  };
};
