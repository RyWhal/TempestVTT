# Procedural Pixel Texture Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace uploaded floor tile dependencies with a deterministic procedural pixel-texture pipeline that generates map-scoped floor variants at bake time and is extensible to future wall and set-dressing layers.

**Architecture:** Introduce a JSON-driven procedural texture recipe system that generates reusable pixel-art variants per biome and map seed, then plugs those generated variants into the existing semantic-map -> bake-chunk pipeline. Keep the current bake orchestrator, chunking, and manifest flow, but swap the tile source from external PNG assets to generated texture variants written as in-memory or artifact-backed raster/SVG textures. The generator core must be generic over `layer_type` and `tile_size_px` so floors can use `128x128` now while future walls and dressing can use different sizes and recipes.

**Tech Stack:** TypeScript, existing procgen bake pipeline, JSON-backed config, Vitest, existing Cloudflare/R2-ready bake architecture

---

## File Structure

### New files

- `DunGEN/procedural_pixel_texture_registry.json`
  - Biome and future layer recipe definitions for procedural textures.
- `src/procgen/bake/ProceduralPixelTextureTypes.ts`
  - Shared types for recipes, palettes, generated variants, and layer options.
- `src/procgen/bake/ProceduralPixelTextureRegistry.ts`
  - JSON loader/validator helpers for the texture registry.
- `src/procgen/bake/ProceduralPixelTextureGenerator.ts`
  - Deterministic generator for map-scoped pixel variants.
- `src/procgen/bake/ProceduralPixelTextureCache.ts`
  - Generates and caches recipe outputs keyed by biome, layer type, tile size, recipe version, and seed.
- `src/procgen/__tests__/proceduralPixelTextureGenerator.test.ts`
  - Determinism and recipe-shape tests.
- `src/procgen/__tests__/proceduralPixelTextureCache.test.ts`
  - Cache key and variant reuse tests.

### Modified files

- `src/procgen/bake/AssetRegistryLoader.ts`
  - Load procedural texture registry and include it in content signatures.
- `src/procgen/bake/TileVariantSelector.ts`
  - Select variant ids/categories while decoupling selection from external image asset references.
- `src/procgen/bake/ChunkCompositor.ts`
  - Render generated texture variants instead of external floor asset URLs.
- `src/procgen/bake/MapBakeOrchestrator.ts`
  - Request map-scoped generated variants and pass them into chunk composition.
- `src/procgen/bake/SemanticMapTypes.ts`
  - Add generated texture variant metadata used by the bake path.
- `src/procgen/bake/README.md`
  - Document the new pixel-texture pipeline and dev/runtime behavior.
- `src/procgen/__tests__/mapBakePipeline.test.ts`
  - Update floor bake assertions for generated pixel textures.

### Files intentionally left alone for v1

- `src/components/map/MapCanvas.tsx`
  - Prefer not to touch unless we need a trivial normalization update; the goal is for the baked chunk output to remain the client contract.
- `src/procgen/render/floorAssetResolver.ts`
  - Keep as fallback/debug only until the procedural path is stable, then remove or de-emphasize in a later cleanup.

---

### Task 1: Add Procedural Texture Recipe Registry

**Files:**
- Create: `DunGEN/procedural_pixel_texture_registry.json`
- Create: `src/procgen/bake/ProceduralPixelTextureTypes.ts`
- Create: `src/procgen/bake/ProceduralPixelTextureRegistry.ts`
- Test: `src/procgen/__tests__/proceduralPixelTextureGenerator.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that loads the procedural registry and asserts:
- `floor` recipes exist for all current biomes
- `tile_size_px` for floor is `128`
- palettes and weights are present
- future-oriented schema supports `layer_type: "floor" | "wall" | "dressing"`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/proceduralPixelTextureGenerator.test.ts`
Expected: FAIL because the registry/types/loader do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create:
- `ProceduralPixelTextureTypes.ts` with types for:
  - `ProceduralLayerType`
  - `PixelTexturePaletteEntry`
  - `ProceduralPatternRules`
  - `ProceduralPixelTextureRecipe`
  - `ProceduralPixelTextureRegistry`
- `procedural_pixel_texture_registry.json` with recipes for:
  - `stone_halls`
  - `garden_hold`
  - `fungal_warrens`
  - fallback stone-family biomes
- `ProceduralPixelTextureRegistry.ts` with a typed loader returning parsed JSON

Registry requirements:
- `layer_type`
- `biome_id`
- `tile_size_px`
- `pixel_scale`
- `palette`
- `color_weights`
- `cluster_rules`
- `accent_rules`
- optional `directional_rules`
- `recipe_version`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/procgen/__tests__/proceduralPixelTextureGenerator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add DunGEN/procedural_pixel_texture_registry.json src/procgen/bake/ProceduralPixelTextureTypes.ts src/procgen/bake/ProceduralPixelTextureRegistry.ts src/procgen/__tests__/proceduralPixelTextureGenerator.test.ts
git commit -m "feat: add procedural pixel texture recipe registry"
```

---

### Task 2: Build Deterministic Procedural Texture Generator

**Files:**
- Create: `src/procgen/bake/ProceduralPixelTextureGenerator.ts`
- Modify: `src/procgen/bake/ProceduralPixelTextureTypes.ts`
- Test: `src/procgen/__tests__/proceduralPixelTextureGenerator.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests asserting:
- same recipe + seed produces identical output
- different variant seeds produce different outputs
- generated output uses only configured palette colors
- `garden_hold` respects directional grain settings

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/proceduralPixelTextureGenerator.test.ts`
Expected: FAIL because generator logic is missing.

- [ ] **Step 3: Write minimal implementation**

Implement `ProceduralPixelTextureGenerator.ts` with:
- deterministic seeded pseudo-random helpers based on existing `seededHash`
- texture generation returning:
  - `variantId`
  - `svg` or raster-friendly image body
  - metadata including dominant colors and recipe id
- supported pattern primitives:
  - weighted base fill
  - clustered secondary-color patches
  - sparse accent pixels/clumps
  - optional directional streaking/grain
  - optional seam-safe border reconciliation

Keep it intentionally simple and strict:
- no transparency
- no anti-aliasing
- only configured colors
- square outputs only in v1

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/procgen/__tests__/proceduralPixelTextureGenerator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/procgen/bake/ProceduralPixelTextureGenerator.ts src/procgen/bake/ProceduralPixelTextureTypes.ts src/procgen/__tests__/proceduralPixelTextureGenerator.test.ts
git commit -m "feat: add deterministic procedural pixel texture generator"
```

---

### Task 3: Add Map-Scoped Variant Cache

**Files:**
- Create: `src/procgen/bake/ProceduralPixelTextureCache.ts`
- Test: `src/procgen/__tests__/proceduralPixelTextureCache.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests asserting:
- cache key includes `layer_type`, `biome_id`, `tile_size_px`, `recipe_version`, and `variant_seed`
- same cache request reuses the same generated variant
- different map seeds generate different variant packs

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/proceduralPixelTextureCache.test.ts`
Expected: FAIL because cache module does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement a cache that:
- builds `4-8` variants per biome per map seed
- stores them in memory for the life of the bake
- exposes lookup by:
  - biome id
  - category
  - chosen variant index/id

Keep the API simple:
- `getOrCreateVariantPack(...)`
- `getVariant(...)`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/procgen/__tests__/proceduralPixelTextureCache.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/procgen/bake/ProceduralPixelTextureCache.ts src/procgen/__tests__/proceduralPixelTextureCache.test.ts
git commit -m "feat: add procedural pixel texture cache"
```

---

### Task 4: Integrate Registry Into Bake Content Loading

**Files:**
- Modify: `src/procgen/bake/AssetRegistryLoader.ts`
- Test: `src/procgen/__tests__/mapBakePipeline.test.ts`

- [ ] **Step 1: Write the failing test**

Add assertions that loaded bake content now includes the procedural texture registry and that content signatures change when the procedural registry changes.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts`
Expected: FAIL because bake content does not yet load the procedural registry.

- [ ] **Step 3: Write minimal implementation**

Update `AssetRegistryLoader.ts` to:
- load `procedural_pixel_texture_registry.json`
- expose it on `LoadedMapBakeContent`
- include it in `getMapBakeContentSignature`
- bump runtime format version for forced rebakes

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/procgen/bake/AssetRegistryLoader.ts src/procgen/__tests__/mapBakePipeline.test.ts
git commit -m "feat: load procedural texture registry into bake content"
```

---

### Task 5: Decouple Tile Selection From External Image Assets

**Files:**
- Modify: `src/procgen/bake/TileVariantSelector.ts`
- Modify: `src/procgen/bake/SemanticMapTypes.ts`
- Test: `src/procgen/__tests__/mapBakePipeline.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test asserting tile selection still produces:
- deterministic category selection
- deterministic variant ids
- anti-repetition behavior
without requiring external image URLs.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts`
Expected: FAIL because selected tiles still assume asset file references.

- [ ] **Step 3: Write minimal implementation**

Refactor selection so it emits:
- biome id
- category
- selected variant key/id
- transform metadata

Selection should choose among generated variant pack entries rather than baked-in external PNG file refs.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/procgen/bake/TileVariantSelector.ts src/procgen/bake/SemanticMapTypes.ts src/procgen/__tests__/mapBakePipeline.test.ts
git commit -m "refactor: select procedural texture variants instead of external assets"
```

---

### Task 6: Render Procedural Variants In Chunk Composition

**Files:**
- Modify: `src/procgen/bake/ChunkCompositor.ts`
- Modify: `src/procgen/bake/MapBakeOrchestrator.ts`
- Test: `src/procgen/__tests__/mapBakePipeline.test.ts`

- [ ] **Step 1: Write the failing test**

Add assertions that baked chunk output:
- includes generated floor imagery for at least two distinct variant ids
- no longer depends on R2 asset URLs for floor tile content
- still preserves transition overlays and deterministic chunk metadata

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts`
Expected: FAIL because chunks still reference external floor asset paths.

- [ ] **Step 3: Write minimal implementation**

Update:
- `MapBakeOrchestrator.ts` to build a map-scoped procedural variant pack for used biomes
- `ChunkCompositor.ts` to embed or reuse generated texture variants in the chunk image output

Implementation notes:
- keep chunk output self-contained
- prefer simple SVG `<pattern>` or embedded image reuse for v1
- maintain `tileSprites` metadata only if still useful for local fallback/debug

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/procgen/__tests__/mapBakePipeline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/procgen/bake/ChunkCompositor.ts src/procgen/bake/MapBakeOrchestrator.ts src/procgen/__tests__/mapBakePipeline.test.ts
git commit -m "feat: bake chunks from procedural pixel textures"
```

---

### Task 7: Update Docs And Remove External Floor Dependency From The Happy Path

**Files:**
- Modify: `src/procgen/bake/README.md`
- Modify: `src/procgen/render/floorAssetResolver.ts`
- Test: `src/procgen/__tests__/mapAdapter.test.ts`

- [ ] **Step 1: Write the failing test**

Add or update a test to document the expected client-facing baked floor contract after the procedural swap.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/mapAdapter.test.ts`
Expected: FAIL if contract wording/behavior changed.

- [ ] **Step 3: Write minimal implementation**

Document:
- procedural texture pipeline behavior
- map-scoped variant generation
- `128x128` floor tile generation
- future extension for wall/dressing sizes

Reduce `floorAssetResolver.ts` to:
- fallback/debug only
- no longer the primary floor-art source for generated maps

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/procgen/__tests__/mapAdapter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/procgen/bake/README.md src/procgen/render/floorAssetResolver.ts src/procgen/__tests__/mapAdapter.test.ts
git commit -m "docs: document procedural pixel floor pipeline"
```

---

### Task 8: End-To-End Verification On Localhost

**Files:**
- Modify as needed: only files touched above
- Test: targeted bake and app verification

- [ ] **Step 1: Run targeted automated verification**

Run:
`npm run test:run -- src/procgen/__tests__/proceduralPixelTextureGenerator.test.ts src/procgen/__tests__/proceduralPixelTextureCache.test.ts src/procgen/__tests__/mapBakePipeline.test.ts src/procgen/__tests__/mapAdapter.test.ts src/procgen/__tests__/inlineArtifactWriter.test.ts`

Expected: PASS

- [ ] **Step 2: Run production build**

Run:
`npm run build`

Expected: PASS

- [ ] **Step 3: Restart Vite and verify localhost manually**

Run:
`npm run dev`

Manual checks:
- generated maps show biome-appropriate procedural floor textures
- `garden_hold` has wood-like directional grain without rotation
- stone-family biomes show multiple deterministic variants
- no external floor PNG loading is required for the happy path
- map launch time is improved relative to the current external-asset path

- [ ] **Step 4: Commit final integration**

```bash
git add DunGEN/procedural_pixel_texture_registry.json src/procgen/bake/ProceduralPixelTextureTypes.ts src/procgen/bake/ProceduralPixelTextureRegistry.ts src/procgen/bake/ProceduralPixelTextureGenerator.ts src/procgen/bake/ProceduralPixelTextureCache.ts src/procgen/bake/AssetRegistryLoader.ts src/procgen/bake/TileVariantSelector.ts src/procgen/bake/SemanticMapTypes.ts src/procgen/bake/ChunkCompositor.ts src/procgen/bake/MapBakeOrchestrator.ts src/procgen/bake/README.md src/procgen/render/floorAssetResolver.ts src/procgen/__tests__/proceduralPixelTextureGenerator.test.ts src/procgen/__tests__/proceduralPixelTextureCache.test.ts src/procgen/__tests__/mapBakePipeline.test.ts src/procgen/__tests__/mapAdapter.test.ts
git commit -m "feat: add procedural pixel texture bake pipeline"
```

---

## Notes

- Keep v1 intentionally floor-only in the runtime path.
- The registry must support future `wall` and `dressing` recipes, but those layers should not be reintroduced until the floor pipeline is stable.
- Prefer deterministic SVG or canvas-friendly output over pulling in native image libraries.
- Avoid overfitting to current uploaded PNG assets; the whole point of this plan is to remove them from the critical path.
