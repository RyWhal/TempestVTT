# Procedural Map Bake Pipeline

This module adds a deterministic, server-side floor bake path for generated Tempest Table sections.

## What it does

- loads JSON-backed biome, asset, and transition config
- resolves semantic room data into visual rules
- selects seeded tile variants with anti-repetition constraints
- resolves biome transitions
- composes chunked floor images
- writes chunk artifacts and a bake manifest
- exposes a Cloudflare Worker/R2-friendly runtime scaffold

## Main entry points

- `createMapBakeOrchestrator` in [MapBakeOrchestrator.ts](/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/bake/MapBakeOrchestrator.ts)
- `createCloudflareMapBakeWorker` in [cloudflareWorker.ts](/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/bake/cloudflareWorker.ts)
- `runSampleBakeJob` in [sampleBakeJob.ts](/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/bake/sampleBakeJob.ts)

## Sample usage

```ts
import { runSampleBakeJob } from './sampleBakeJob';

const { result, writes } = await runSampleBakeJob();
console.log(result.manifest);
console.log(writes.map((entry) => entry.path));
```

## Current v1 behavior

- baked chunks are emitted as SVG images for deterministic server-side composition without extra native image dependencies
- client rendering prefers baked chunk images when `generatedRenderPayload.bakedFloor.status === "complete"`
- generated floor rects remain in the payload as fallback/debug geometry
