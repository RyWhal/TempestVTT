# DunGEN Biome Map Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add JSON-driven biome generation profiles, settlement livability rules, and floor-material asset resolution so generated maps vary materially by biome and can pick up Cloudflare-hosted floor tiles with fallback.

**Architecture:** The implementation should introduce three coordinated layers: deterministic biome/settlement profile resolution in the generator, JSON-backed floor-material and transition definitions, and a small asset resolver that maps semantic material keys to predictable URLs with fallback. Generator code should emit material keys and livability outcomes; the renderer should consume those outputs without hardcoding biome or storage behavior.

**Tech Stack:** React, TypeScript, Zustand, Vitest, Vite, JSON content packs

---

### Task 1: Add normalized biome and material content packs

**Files:**
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/DunGEN/biome_generation_profiles.json`
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/DunGEN/settlement_generation_profiles.json`
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/DunGEN/floor_material_profiles.json`
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/DunGEN/floor_transition_profiles.json`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/types.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/content/contentManifest.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/content/normalizeContentPack.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/contentRegistry.test.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/normalizeContentPack.test.ts`

- [ ] **Step 1: Write failing content-pack tests**

Add assertions for:
- `contentRegistry.loadPack('biome_generation_profiles')`
- `contentRegistry.loadPack('settlement_generation_profiles')`
- `contentRegistry.loadPack('floor_material_profiles')`
- `contentRegistry.loadPack('floor_transition_profiles')`

Run: `npm run test:run -- src/procgen/__tests__/contentRegistry.test.ts src/procgen/__tests__/normalizeContentPack.test.ts`
Expected: FAIL because the packs are unknown or normalize incorrectly.

- [ ] **Step 2: Add JSON packs with normalized `entries` roots**

Seed the files with a minimal but useful set of profiles:
- biomes: `bone_gallery`, `slime_cavern`, `fungal_warrens`, `molten_forge`, `ice_vault`, `garden_hold`
- settlement profiles: `waystop`, `farm_enclave`, `garden_hold`, `shrine_hamlet`, `salvage_town`, `hidden_refuge`
- floor materials: `cobblestone`, `dungeon_stone`, `ice_floor`, `wood_planks`, `messy_stone`, `carpet_red`
- transitions: `ice_to_stone`, `stone_to_carpet`, `wood_to_messy_stone`

- [ ] **Step 3: Add types, manifest entries, and normalization**

Extend the procgen types and registry normalization so each pack loads through the same JSON-first path as the existing deterministic content packs.

- [ ] **Step 4: Run the content-pack tests**

Run: `npm run test:run -- src/procgen/__tests__/contentRegistry.test.ts src/procgen/__tests__/normalizeContentPack.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add DunGEN/biome_generation_profiles.json DunGEN/settlement_generation_profiles.json DunGEN/floor_material_profiles.json DunGEN/floor_transition_profiles.json src/procgen/types.ts src/procgen/content/contentManifest.ts src/procgen/content/normalizeContentPack.ts src/procgen/__tests__/contentRegistry.test.ts src/procgen/__tests__/normalizeContentPack.test.ts
git commit -m "feat: add biome and floor material content packs"
```

### Task 2: Add deterministic section profile and livability resolution

**Files:**
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/sectionProfileResolver.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/campaignFlow.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/sectionGenerator.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/types.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/campaignFlow.test.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/sectionGenerator.test.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/sectionProfileResolver.test.ts`

- [ ] **Step 1: Write failing tests for profile resolution**

Add tests proving:
- same seed + same coordinates resolves the same biome/settlement profile
- downstream sections can deterministically become settlements
- low-livability sections remain exploration sections
- section profile resolution exposes primitive density and floor material defaults

Run: `npm run test:run -- src/procgen/__tests__/campaignFlow.test.ts src/procgen/__tests__/sectionGenerator.test.ts src/procgen/__tests__/sectionProfileResolver.test.ts`
Expected: FAIL because the resolver does not exist yet.

- [ ] **Step 2: Implement `sectionProfileResolver.ts`**

Implement a small pure resolver that:
- loads biome and settlement profile packs
- computes a livability score from biome, openness, route centrality, safety, food, and water modifiers
- resolves:
  - `sectionKind`
  - `settlementProfileId`
  - `biomeProfileId`
  - `defaultFloorMaterialKey`
  - primitive density settings

- [ ] **Step 3: Thread section profile resolution into campaign flow**

Update preview generation and preview-to-visited promotion so downstream nodes can become settlements beyond `Hometown`, while preserving coordinate-aware graph behavior.

- [ ] **Step 4: Thread profile data into section generation**

Update section generation inputs so layout generation can access the resolved profile instead of relying on coarse section-kind branching alone.

- [ ] **Step 5: Run the resolver/generator tests**

Run: `npm run test:run -- src/procgen/__tests__/campaignFlow.test.ts src/procgen/__tests__/sectionGenerator.test.ts src/procgen/__tests__/sectionProfileResolver.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/procgen/engine/sectionProfileResolver.ts src/procgen/engine/campaignFlow.ts src/procgen/engine/sectionGenerator.ts src/procgen/types.ts src/procgen/__tests__/campaignFlow.test.ts src/procgen/__tests__/sectionGenerator.test.ts src/procgen/__tests__/sectionProfileResolver.test.ts
git commit -m "feat: add biome profile and livability resolution"
```

### Task 3: Make room placement respect biome primitive density

**Files:**
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/roomPlacement.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/layoutPresets.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/sectionGenerator.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/sectionGenerator.test.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/roomPlacement.test.ts`

- [ ] **Step 1: Write failing density-behavior tests**

Add tests proving:
- profile density changes primitive selection frequency
- open biomes prefer more spaced placement
- settlement profiles can prefer plazas/open clusters over corridor-heavy packing

Run: `npm run test:run -- src/procgen/__tests__/sectionGenerator.test.ts src/procgen/__tests__/roomPlacement.test.ts`
Expected: FAIL because placement ignores density-specific profile settings.

- [ ] **Step 2: Update primitive selection to use density weights**

Refactor room placement so allowlists and density both matter:
- allowed primitive families constrain the pool
- density and openness bias the choice and placement

- [ ] **Step 3: Update layout presets to respect profile-driven spacing**

Keep the current deterministic preset approach, but let profile settings influence spacing and primitive clustering so maps feel more biome-specific without a total rewrite.

- [ ] **Step 4: Run placement tests**

Run: `npm run test:run -- src/procgen/__tests__/sectionGenerator.test.ts src/procgen/__tests__/roomPlacement.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/procgen/engine/roomPlacement.ts src/procgen/engine/layoutPresets.ts src/procgen/engine/sectionGenerator.ts src/procgen/__tests__/sectionGenerator.test.ts src/procgen/__tests__/roomPlacement.test.ts
git commit -m "feat: add biome-aware primitive density rules"
```

### Task 4: Add floor material and transition assignment to generated maps

**Files:**
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/types.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/map/buildSectionRenderPayload.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/integration/mapAdapter.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/mapAdapter.test.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/sectionGenerator.test.ts`

- [ ] **Step 1: Write failing render-payload tests**

Add tests proving:
- floor regions carry `materialKey`
- transition regions carry `transitionMaterialKey` where configured
- fallback floor material is present even if a biome-specific key is missing

Run: `npm run test:run -- src/procgen/__tests__/mapAdapter.test.ts src/procgen/__tests__/sectionGenerator.test.ts`
Expected: FAIL because generated floor regions do not yet carry material metadata.

- [ ] **Step 2: Extend generated render payload types**

Add floor-region metadata fields such as:
- `materialKey`
- `transitionMaterialKey`
- `materialCategory`

- [ ] **Step 3: Assign floor materials and transitions**

Update `buildSectionRenderPayload.ts` to assign:
- default material keys by section/biome profile
- alternate or landmark materials where appropriate
- transition keys between adjacent material families where configured

- [ ] **Step 4: Run payload tests**

Run: `npm run test:run -- src/procgen/__tests__/mapAdapter.test.ts src/procgen/__tests__/sectionGenerator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/procgen/types.ts src/procgen/map/buildSectionRenderPayload.ts src/procgen/integration/mapAdapter.ts src/procgen/__tests__/mapAdapter.test.ts src/procgen/__tests__/sectionGenerator.test.ts
git commit -m "feat: add floor material keys to generated maps"
```

### Task 5: Add the asset resolver layer for predictable R2 floor tiles

**Files:**
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/assets/floorAssetResolver.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/types.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/MapCanvas.tsx`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/floorAssetResolver.test.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/mapAdapter.test.ts`

- [ ] **Step 1: Write failing resolver tests**

Add tests proving:
- `ice_floor` resolves to `tiles/floors/ice_floor.png`
- `ice_to_stone` resolves to `tiles/transitions/ice_to_stone.png`
- missing material falls back to `cobblestone`

Run: `npm run test:run -- src/procgen/__tests__/floorAssetResolver.test.ts src/procgen/__tests__/mapAdapter.test.ts`
Expected: FAIL because no asset resolver exists yet.

- [ ] **Step 2: Implement `floorAssetResolver.ts`**

Add a small pure resolver that:
- accepts floor material or transition keys
- returns predictable public asset URLs
- falls back to configured generic material keys

- [ ] **Step 3: Thread resolver output into map rendering**

Keep walls as black outlines, but make floor regions renderer-ready by resolving their material URLs where available.

- [ ] **Step 4: Run resolver and map tests**

Run: `npm run test:run -- src/procgen/__tests__/floorAssetResolver.test.ts src/procgen/__tests__/mapAdapter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/procgen/assets/floorAssetResolver.ts src/procgen/types.ts src/components/map/MapCanvas.tsx src/procgen/__tests__/floorAssetResolver.test.ts src/procgen/__tests__/mapAdapter.test.ts
git commit -m "feat: add floor asset resolver with fallback"
```

### Task 6: Verify the end-to-end biome generator slice

**Files:**
- Verify only

- [ ] **Step 1: Run targeted procgen suite**

Run:

```bash
npm run test:run -- src/procgen/__tests__/contentRegistry.test.ts src/procgen/__tests__/normalizeContentPack.test.ts src/procgen/__tests__/sectionProfileResolver.test.ts src/procgen/__tests__/sectionGenerator.test.ts src/procgen/__tests__/roomPlacement.test.ts src/procgen/__tests__/mapAdapter.test.ts src/procgen/__tests__/floorAssetResolver.test.ts src/procgen/__tests__/campaignFlow.test.ts src/procgen/__tests__/dungen-campaign-view.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS with only the existing Vite chunk-size warning.

- [ ] **Step 3: Manual browser checks**

Verify in local development:
- different biomes produce noticeably different geometry
- some downstream nodes become settlements beyond `Hometown`
- overview and campaign book continue working
- generated floors still render if no R2 assets are present
- if a floor asset is added later under a predictable key, the generator picks it up automatically

- [ ] **Step 4: Commit verification-only fixes if needed**

```bash
git add -A
git commit -m "fix: stabilize biome map generator integration"
```

