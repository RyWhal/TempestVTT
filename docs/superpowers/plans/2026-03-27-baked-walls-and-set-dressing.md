# Baked Walls And Set Dressing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the procedural map bake pipeline so Tempest can serve one baked environmental map layer containing textured floors, textured wall bands, and static visual set dressing, while leaving doors out of scope for v1.

**Architecture:** Keep generation semantic-first. Add wall and dressing registries plus deterministic resolver/placement passes, then extend the existing bake compositor to stamp floor, wall, and dressing layers into the baked environment output. The client should keep using the generated render payload for structural/debug fallback, but prefer the fully baked environment layer whenever it is complete.

**Tech Stack:** TypeScript, Vitest, existing procgen engine, existing bake orchestrator/compositor, JSON-backed content packs, Cloudflare Worker/R2 bake scaffold, React/Konva client renderer.

---

## File Map

**Existing files to modify**
- `src/procgen/types.ts`
  Responsibility: Shared procedural render and content types.
- `src/procgen/map/buildSectionRenderPayload.ts`
  Responsibility: Structural render payload builder for floors, walls, markers, and future objects.
- `src/procgen/bake/AssetRegistryLoader.ts`
  Responsibility: Load JSON-backed bake config and registries.
- `src/procgen/bake/SemanticMapTypes.ts`
  Responsibility: Bake-stage semantic and artifact types.
- `src/procgen/bake/ChunkCompositor.ts`
  Responsibility: Bake floor chunks and emit chunk metadata for client fallback/debug.
- `src/procgen/bake/MapBakeOrchestrator.ts`
  Responsibility: Coordinate all bake passes and manifest output.
- `src/procgen/integration/mapAdapter.ts`
  Responsibility: Normalize baked payload into client-facing generated map payload.
- `src/components/map/MapCanvas.tsx`
  Responsibility: Render baked environment output and structural fallbacks.
- `src/procgen/__tests__/mapBakePipeline.test.ts`
  Responsibility: Bake pipeline regression coverage.
- `src/procgen/__tests__/mapAdapter.test.ts`
  Responsibility: Client payload normalization tests.

**New files to create**
- `DunGEN/wall_asset_registry.json`
  Responsibility: Biome-to-wallset registry with weighted wall texture variants and transform flags.
- `DunGEN/set_dressing_asset_registry.json`
  Responsibility: Asset families for clutter, roots, moss, stones, crates, tables, beds, bedrolls, barrels, rocks, and garden patches.
- `DunGEN/set_dressing_rules.json`
  Responsibility: Biome/room-type placement rules, density caps, exclusions, and spawn weights for static dressing.
- `src/procgen/bake/WallRuleResolver.ts`
  Responsibility: Resolve biome wall visual rules and pick wall asset families.
- `src/procgen/bake/WallVariantSelector.ts`
  Responsibility: Deterministic weighted wall variant selection with repetition control.
- `src/procgen/bake/SetDressingResolver.ts`
  Responsibility: Deterministic static dressing placement by room type, biome, and section kind.
- `src/procgen/bake/SetDressingTypes.ts`
  Responsibility: Shared set dressing placement and registry types.
- `src/procgen/__tests__/setDressingResolver.test.ts`
  Responsibility: Deterministic placement and density/exclusion tests.

## Task 1: Add Registries And Shared Types

**Files:**
- Create: `DunGEN/wall_asset_registry.json`
- Create: `DunGEN/set_dressing_asset_registry.json`
- Create: `DunGEN/set_dressing_rules.json`
- Create: `src/procgen/bake/SetDressingTypes.ts`
- Modify: `src/procgen/bake/AssetRegistryLoader.ts`
- Modify: `src/procgen/types.ts`
- Test: `src/procgen/__tests__/mapBakePipeline.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test to `src/procgen/__tests__/mapBakePipeline.test.ts` that loads bake content and expects:
- wall registry content to exist
- set dressing registry content to exist
- every biome generation profile to have a wall registry entry

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts`
Expected: FAIL because wall/set-dressing registry content is not loaded yet.

- [ ] **Step 3: Write minimal implementation**

Create the three JSON registries and wire them into `AssetRegistryLoader.ts`.

Implementation requirements:
- `wall_asset_registry.json`
  - biome-keyed entries
  - weighted `base` wall variants
  - `rotation_safe` and `flip_safe`
  - allow multiple biomes to point to one shared texture family initially
- `set_dressing_asset_registry.json`
  - categories for `roots`, `moss_patches`, `strewn_stones`, `garden_patches`, `crates`, `tables`, `beds`, `bedrolls`, `barrels`, `rocks`
- `set_dressing_rules.json`
  - room-type and biome placement rules
  - per-category density caps
  - exclusions for corridors vs rooms vs hubs
- extend `src/procgen/types.ts` and `src/procgen/bake/SetDressingTypes.ts` with the new types
- extend `AssetRegistryLoader.ts` to load and expose the new registries

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add DunGEN/wall_asset_registry.json DunGEN/set_dressing_asset_registry.json DunGEN/set_dressing_rules.json src/procgen/bake/SetDressingTypes.ts src/procgen/bake/AssetRegistryLoader.ts src/procgen/types.ts src/procgen/__tests__/mapBakePipeline.test.ts
git commit -m "feat: add wall and set dressing registries"
```

## Task 2: Add Deterministic Wall Selection

**Files:**
- Create: `src/procgen/bake/WallRuleResolver.ts`
- Create: `src/procgen/bake/WallVariantSelector.ts`
- Modify: `src/procgen/bake/SemanticMapTypes.ts`
- Modify: `src/procgen/bake/MapBakeOrchestrator.ts`
- Test: `src/procgen/__tests__/mapBakePipeline.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests that:
- resolve wall assets for a biome deterministically
- choose the same wall variants for the same seed
- cover every biome in the wall registry

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts`
Expected: FAIL because wall resolver/selector modules do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- `WallRuleResolver.ts`
  - biome -> wallset resolution
  - fallback to shared wall family if biome-specific wallset is absent
- `WallVariantSelector.ts`
  - deterministic seeded weighted selection
  - optional repetition penalty for adjacent wall segments
- extend `SemanticMapTypes.ts`
  - typed selected wall segment asset records
- update `MapBakeOrchestrator.ts`
  - run wall resolution/selection alongside floor selection

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/procgen/bake/WallRuleResolver.ts src/procgen/bake/WallVariantSelector.ts src/procgen/bake/SemanticMapTypes.ts src/procgen/bake/MapBakeOrchestrator.ts src/procgen/__tests__/mapBakePipeline.test.ts
git commit -m "feat: add deterministic wall variant selection"
```

## Task 3: Add Deterministic Static Set Dressing Placement

**Files:**
- Create: `src/procgen/bake/SetDressingResolver.ts`
- Modify: `src/procgen/bake/SetDressingTypes.ts`
- Modify: `src/procgen/bake/SemanticMapTypes.ts`
- Modify: `src/procgen/bake/MapBakeOrchestrator.ts`
- Test: `src/procgen/__tests__/setDressingResolver.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/procgen/__tests__/setDressingResolver.test.ts` with tests that verify:
- deterministic placement for the same seed
- density caps are respected
- room-type exclusions are respected
- placements are visual-only and do not alter walkable geometry

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/setDressingResolver.test.ts`
Expected: FAIL because resolver and types do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement `SetDressingResolver.ts` that:
- reads `set_dressing_rules.json`
- uses room tags and section kind to decide eligible categories
- seeds placement deterministically by map seed + room id + category + local position
- emits visual placement records only

Update orchestrator/types so dressing placements are available to the compositor and manifest/debug output.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/procgen/__tests__/setDressingResolver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/procgen/bake/SetDressingResolver.ts src/procgen/bake/SetDressingTypes.ts src/procgen/bake/SemanticMapTypes.ts src/procgen/bake/MapBakeOrchestrator.ts src/procgen/__tests__/setDressingResolver.test.ts
git commit -m "feat: add deterministic static set dressing placement"
```

## Task 4: Bake Textured Wall Bands

**Files:**
- Modify: `src/procgen/map/buildSectionRenderPayload.ts`
- Modify: `src/procgen/bake/ChunkCompositor.ts`
- Modify: `src/procgen/bake/SemanticMapTypes.ts`
- Test: `src/procgen/__tests__/mapAdapter.test.ts`
- Test: `src/procgen/__tests__/mapBakePipeline.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests that expect baked payloads to include wall-band metadata and that baked wall output is deterministic for the same seed.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts src/procgen/__tests__/mapAdapter.test.ts`
Expected: FAIL because walls are not part of baked chunk metadata yet.

- [ ] **Step 3: Write minimal implementation**

Update `buildSectionRenderPayload.ts` and `ChunkCompositor.ts` so:
- existing wall lines are converted into textured wall bands
- band width derives from existing wall stroke width
- selected wall textures are stamped into baked chunk output
- wall output is stored in baked-environment metadata for client fallback/debug

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts src/procgen/__tests__/mapAdapter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/procgen/map/buildSectionRenderPayload.ts src/procgen/bake/ChunkCompositor.ts src/procgen/bake/SemanticMapTypes.ts src/procgen/__tests__/mapBakePipeline.test.ts src/procgen/__tests__/mapAdapter.test.ts
git commit -m "feat: bake textured wall bands"
```

## Task 5: Bake Static Set Dressing Into The Environment Layer

**Files:**
- Modify: `src/procgen/bake/ChunkCompositor.ts`
- Modify: `src/procgen/integration/mapAdapter.ts`
- Modify: `src/components/map/MapCanvas.tsx`
- Test: `src/procgen/__tests__/mapBakePipeline.test.ts`
- Test: `src/procgen/__tests__/mapAdapter.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests that expect:
- baked chunk metadata to include dressing placements
- client normalization to preserve dressing metadata
- client fallback renderer to draw dressing when chunk image fallback is used

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts src/procgen/__tests__/mapAdapter.test.ts`
Expected: FAIL because dressing is not baked/rendered yet.

- [ ] **Step 3: Write minimal implementation**

Update:
- `ChunkCompositor.ts`
  - stamp dressing sprites into baked output
  - emit dressing sprite fallback metadata
- `mapAdapter.ts`
  - normalize dressing metadata
- `MapCanvas.tsx`
  - render dressing sprite fallback under the same baked-environment rules as floor sprites

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts src/procgen/__tests__/mapAdapter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/procgen/bake/ChunkCompositor.ts src/procgen/integration/mapAdapter.ts src/components/map/MapCanvas.tsx src/procgen/__tests__/mapBakePipeline.test.ts src/procgen/__tests__/mapAdapter.test.ts
git commit -m "feat: bake static set dressing into environment layer"
```

## Task 6: Collapse To One Baked Environment Layer

**Files:**
- Modify: `src/procgen/bake/MapBakeOrchestrator.ts`
- Modify: `src/procgen/bake/BakeManifestWriter.ts`
- Modify: `src/procgen/integration/mapAdapter.ts`
- Modify: `src/components/map/MapCanvas.tsx`
- Modify: `src/procgen/bake/README.md`
- Test: `src/procgen/__tests__/mapBakePipeline.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that expects the final baked environment payload to represent one preferred environmental surface, with floors, wall bands, and static dressing all included in the baked layer.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts`
Expected: FAIL because the environment layer is still floor-centric only.

- [ ] **Step 3: Write minimal implementation**

Update orchestrator, manifest writer, adapter, and map canvas so:
- the baked payload is treated as one baked environment layer
- floors remain the base
- wall bands and dressing are baked into the same output
- structural client fallbacks remain available for debug and resilience
- README documents the new baked environment scope

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/procgen/bake/MapBakeOrchestrator.ts src/procgen/bake/BakeManifestWriter.ts src/procgen/integration/mapAdapter.ts src/components/map/MapCanvas.tsx src/procgen/bake/README.md src/procgen/__tests__/mapBakePipeline.test.ts
git commit -m "feat: ship baked environment layer"
```

## Task 7: Final Verification

**Files:**
- Modify: none unless fixes are required
- Test: `src/procgen/__tests__/campaignFlow.test.ts`
- Test: `src/procgen/__tests__/sectionProfileResolver.test.ts`
- Test: `src/procgen/__tests__/mapBakePipeline.test.ts`
- Test: `src/procgen/__tests__/mapAdapter.test.ts`
- Test: `src/procgen/__tests__/setDressingResolver.test.ts`

- [ ] **Step 1: Run focused regression suite**

Run:

```bash
npm run test:run -- src/procgen/__tests__/campaignFlow.test.ts src/procgen/__tests__/sectionProfileResolver.test.ts src/procgen/__tests__/mapBakePipeline.test.ts src/procgen/__tests__/mapAdapter.test.ts src/procgen/__tests__/setDressingResolver.test.ts
```

Expected: PASS

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Manual product sanity check**

Check:
- starter village and adjacent branches still generate
- baked environment layer renders at correct scale
- walls are textured bands, not just flat lines
- static dressing appears and is deterministic for the same seed
- no doors are introduced into the baked layer

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: verify baked walls and static dressing"
```
