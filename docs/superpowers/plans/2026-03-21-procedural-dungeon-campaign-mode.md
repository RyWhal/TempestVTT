# Procedural Dungeon Campaign Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a content-first DunGEN campaign mode to StormlightVTT that can generate, preview, lock, render, and persist dungeon sections through a separate `/DunGEN` product surface while reusing and extending the VTT as the play shell.

**Architecture:** Build DunGEN as a content-first domain and UI surface inside the existing Vite/React app, anchored on a dedicated `/DunGEN` route for campaign creation, prep, history, preview, and canon management. Persist deterministic world state through new Supabase tables/JSONB payloads, treat the current `DunGEN` folder as the initial content source, normalize its file names and shapes through a registry layer, and adapt locked/generated sections into the existing VTT runtime as a play shell rather than forcing the new system into the current uploaded-map-first workflow.

**Tech Stack:** React 18, TypeScript, Vite, Zustand, Konva/react-konva, Supabase, JSON content packs in `DunGEN`, Vitest for new unit tests.

---

## References

- Spec: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/DunGEN/procedural-dungeon-campaign-spec.md`
- Design: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/specs/2026-03-21-dungen-content-first-design.md`
- Existing content pack folder: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/DunGEN`

## Current Baseline

- The app is a client-heavy React VTT with Supabase persistence and realtime sync.
- Maps are currently uploaded static images stored in the `maps` table and rendered by [`src/components/map/MapCanvas.tsx`](/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/MapCanvas.tsx).
- GM map controls are centered in [`src/components/gm/MapManager.tsx`](/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/gm/MapManager.tsx) and [`src/components/gm/GMPanel.tsx`](/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/gm/GMPanel.tsx).
- Session loading is centralized in [`src/hooks/useSession.ts`](/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useSession.ts).
- Shared client types live in [`src/types/index.ts`](/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/types/index.ts).
- Current database schema only knows about sessions, uploaded maps, characters, NPC templates/instances, chat, and dice in [`supabase/migrations/001_initial_schema.sql`](/Users/nonomaybeyes/Documents/projects/StormlightVTT/supabase/migrations/001_initial_schema.sql).

## Content Reality Check

The current `DunGEN` folder is a good seed set, but it does not yet match the final schema catalog one-to-one.

- Already present and broadly aligned:
  - `biomes.json`
  - `creatures.json` containing `creature_families`
  - `creature_variant_modifiers.json` containing `creature_variants`
  - `gen_names_phonemes.json` containing phoneme sets
  - `npc_anchor_templates.json`
  - `npc_generation_schema.json`
  - `npc_modifiers.json`
  - `npc_role_to_anchor_mapping.json`
  - `npc_roles.json`
  - `village_archetypes.json`
  - `genai_description_schema.json`
- Missing or not yet represented in the repo:
  - room primitives and room type libraries
  - section layout presets
  - shop types and shop instances
  - dungeon graph and section state schemas
  - object/hazard/lighting/atmosphere packs
  - loot tables
  - override/session presentation schemas beyond current map/fog/token state

Do not rename the existing `DunGEN` files as the first step. Introduce a content registry that can alias current file names to canonical schema IDs, then rename later only if it still feels worth it.

## Proposed File Structure

### New procgen domain

- Create: `src/procgen/types.ts`
- Create: `src/procgen/content/contentManifest.ts`
- Create: `src/procgen/content/loadContentPack.ts`
- Create: `src/procgen/content/normalizeContentPack.ts`
- Create: `src/procgen/content/contentRegistry.ts`
- Create: `src/procgen/engine/seed.ts`
- Create: `src/procgen/engine/layoutPresets.ts`
- Create: `src/procgen/engine/roomPlacement.ts`
- Create: `src/procgen/engine/roomAssignment.ts`
- Create: `src/procgen/engine/sectionGenerator.ts`
- Create: `src/procgen/engine/entityGenerator.ts`
- Create: `src/procgen/map/buildSectionRenderPayload.ts`
- Create: `src/procgen/integration/mapAdapter.ts`
- Create: `src/procgen/integration/tokenBindings.ts`
- Create: `src/procgen/state/procgenStoreTypes.ts`
- Create: `src/procgen/state/defaultCampaignState.ts`

### New client state/hooks

- Create: `src/stores/procgenStore.ts`
- Create: `src/hooks/useProcgenCampaign.ts`
- Create: `src/hooks/useProcgenContent.ts`

### New GM UI

- Create: `src/components/gm/ProcgenCampaignManager.tsx`
- Create: `src/components/gm/ProcgenSectionPanel.tsx`
- Create: `src/components/gm/ProcgenRoomPanel.tsx`
- Create: `src/components/gm/ProcgenModeToggle.tsx`

### New DunGEN route surfaces

- Create: `src/components/dungen/DunGENHome.tsx`
- Create: `src/components/dungen/DunGENCampaignView.tsx`
- Create: `src/components/dungen/DunGENHistoryPanel.tsx`
- Create: `src/components/dungen/DunGENLaunchBar.tsx`
- Create: `src/components/dungen/DunGENLayout.tsx`

### Existing files to modify

- Modify: `package.json`
- Modify: `src/types/index.ts`
- Modify: `src/App.tsx`
- Modify: `src/hooks/useSession.ts`
- Modify: `src/hooks/useMap.ts`
- Modify: `src/stores/mapStore.ts`
- Modify: `src/components/gm/GMPanel.tsx`
- Modify: `src/components/gm/MapManager.tsx`
- Modify: `src/components/play/PlaySession.tsx`
- Modify: `src/components/map/MapCanvas.tsx`
- Modify: `src/components/gm/SessionExport.tsx`
- Modify: `supabase/migrations/001_initial_schema.sql` only if a follow-up corrective migration is needed; prefer additive migrations instead

### New database migration

- Create: `supabase/migrations/003_procgen_campaign_mode.sql`
- Create: `supabase/migrations/004_shared_dungen_assets.sql`

### New tests

- Create: `src/procgen/__tests__/seed.test.ts`
- Create: `src/procgen/__tests__/contentRegistry.test.ts`
- Create: `src/procgen/__tests__/sectionGenerator.test.ts`
- Create: `src/procgen/__tests__/mapAdapter.test.ts`
- Create: `src/procgen/__tests__/tokenBindings.test.ts`

### New placeholder content packs

- Create: `DunGEN/room_primitives.json`
- Create: `DunGEN/room_type_library.json`
- Create: `DunGEN/section_layout_presets.json`
- Create: `DunGEN/shop_types.json`
- Create: `DunGEN/object_prefabs.json`
- Create: `DunGEN/hazard_templates.json`
- Create: `DunGEN/tile_palettes.json`
- Create: `DunGEN/loot_tables.json`

## Milestones

### Milestone 1: Foundation

Deliver deterministic seeds, canonical TypeScript schemas, a content registry that can load the existing `DunGEN` files without breaking on name mismatches, and the route shell for `/DunGEN`.

### Milestone 2: Engine + Persistence

Deliver section/room generation as pure functions plus Supabase persistence for campaign state, section state, preview/lock status, overrides, and shared asset references.

### Milestone 3: Render + GM Flow

Deliver generated section rendering in the play shell and add GM controls for preview, lock, reroll, reveal, adjacent-section read-ahead, and campaign history from `/DunGEN`.

### Milestone 4: Richness + Polish

Deliver settlement/shop/encounter richness, export/import support, missing content packs, shared asset caching, and optional AI flavor layers.

## Product Boundary

- `/DunGEN` is the GM-facing campaign product surface.
- `/play` is the runtime play shell.
- DunGEN content is the source of truth.
- The VTT is allowed to change shape where DunGEN content needs bespoke tools.
- Shared assets must be global and reusable across campaigns and sessions.

## Task 1: Add Procgen Test Harness, Route Shell, And Module Boundary

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `src/App.tsx`
- Create: `src/components/dungen/DunGENLayout.tsx`
- Create: `src/components/dungen/DunGENHome.tsx`
- Create: `src/procgen/types.ts`
- Test: `src/procgen/__tests__/seed.test.ts`

- [ ] Add `vitest` to `devDependencies` and add scripts for `test` and `test:watch`.
- [ ] Keep the procgen engine framework-agnostic: `src/procgen` should not import React, Konva, or Supabase directly.
- [ ] Add the `/DunGEN` route now, even if the first screen is mostly placeholder scaffolding.
- [ ] Keep `/DunGEN` separate from `/play`; do not start by embedding DunGEN creation flow inside the current play route.
- [ ] Define the first shared domain types in `src/procgen/types.ts`: `CampaignConfig`, `DungeonSection`, `SectionConnection`, `RoomPrimitive`, `RoomInstance`, `SectionRenderPayload`, `GMOverridePatch`, `SessionPresentationState`.
- [ ] Write `src/procgen/__tests__/seed.test.ts` first with deterministic seed assertions:
  - same inputs produce the same child seed
  - different section IDs produce different section seeds
  - lock state is not part of seed derivation
- [ ] Add a minimal `src/procgen/engine/seed.ts` implementation only after the test exists.
- [ ] Run: `npm run test -- seed`
- [ ] Expected: `PASS` for deterministic seed tests.
- [ ] Run: `npm run build`
- [ ] Expected: build succeeds with the new procgen module present but unused by UI.

## Task 2: Normalize Existing DunGEN Content Through A Registry Layer

**Files:**
- Create: `src/procgen/content/contentManifest.ts`
- Create: `src/procgen/content/loadContentPack.ts`
- Create: `src/procgen/content/normalizeContentPack.ts`
- Create: `src/procgen/content/contentRegistry.ts`
- Test: `src/procgen/__tests__/contentRegistry.test.ts`

- [ ] Create a manifest that maps canonical schema IDs to current repo file names.
- [ ] Include aliases immediately:
  - `creature_families` -> `DunGEN/creatures.json`
  - `creature_variants` -> `DunGEN/creature_variant_modifiers.json`
  - `name_phonemes` -> `DunGEN/gen_names_phonemes.json`
- [ ] Decide one canonical in-memory shape per content type. Do not let file-name quirks leak into the generator.
- [ ] Write failing tests for content normalization:
  - loading `creatures.json` yields `creatureFamilies[]`
  - loading `creature_variant_modifiers.json` yields `creatureVariants[]`
  - missing optional packs return a typed empty/default structure instead of crashing
- [ ] Implement `contentRegistry.ts` to return typed content packs to the engine.
- [ ] Add a small validation surface that throws on malformed required packs and tolerates absent future packs.
- [ ] Run: `npm run test -- contentRegistry`
- [ ] Expected: current `DunGEN` folder loads cleanly using aliases.

## Task 3: Define The Procgen Persistence And Shared Asset Model In TypeScript And Supabase

**Files:**
- Create: `supabase/migrations/003_procgen_campaign_mode.sql`
- Create: `supabase/migrations/004_shared_dungen_assets.sql`
- Modify: `src/types/index.ts`
- Create: `src/procgen/state/procgenStoreTypes.ts`
- Create: `src/procgen/state/defaultCampaignState.ts`

- [ ] Add client types for the new persisted entities:
  - `CampaignWorld`
  - `DungeonGraph`
  - `DungeonSectionRecord`
  - `RoomStateRecord`
  - `GMOverrideRecord`
  - `ProcgenCampaignSummary`
  - `SharedAssetRecord`
- [ ] Add a global shared asset cache model now, even if automated image generation is a later milestone.
- [ ] Shared assets must not be session-owned blobs.
- [ ] Campaign and section content should store asset references or asset keys, not copies.
- [ ] Add new database tables with additive migration only. Do not overload the existing `maps` table with canonical procgen state.
- [ ] Keep the three-layer separation from the spec:
  - generation state
  - session presentation state
  - GM override state
- [ ] Prefer JSONB for nested graph/room payloads where relational modeling would slow iteration.
- [ ] The migration should minimally include:
  - `procgen_campaigns`
  - `procgen_sections`
  - `procgen_room_states`
  - `procgen_overrides`
  - `procgen_section_previews`
- [ ] Add a shared asset migration with a table shaped around:
  - `asset_key`
  - `asset_type`
  - `generation_status`
  - `prompt_version`
  - `source_fingerprint`
  - `storage_url`
- [ ] Design the asset cache so missing art never blocks play.
- [ ] Add foreign keys back to `sessions` so procedural campaigns remain session-scoped.
- [ ] Write migration comments explaining which columns are canonical and which are presentation-only.
- [ ] Run: `npm run build`
- [ ] Expected: frontend types compile against the new schema definitions.

## Task 4: Implement Deterministic Section And Room Generation

**Files:**
- Create: `src/procgen/engine/layoutPresets.ts`
- Create: `src/procgen/engine/roomPlacement.ts`
- Create: `src/procgen/engine/roomAssignment.ts`
- Create: `src/procgen/engine/sectionGenerator.ts`
- Test: `src/procgen/__tests__/sectionGenerator.test.ts`

- [ ] Write failing tests before implementation for the core section constraints:
  - section grid is always `100 x 100`
  - room count stays within `1-12`
  - every room is reachable from an entrance
  - each section has at least one exit
  - no room overlap occurs for non-`multi_level_stack` layouts
  - identical seed + section ID yields identical output
- [ ] Implement layout preset selection separately from room semantic assignment.
- [ ] Keep geometry and meaning separate:
  - `roomPlacement.ts` handles primitives, bounds, and connectivity
  - `roomAssignment.ts` handles room type, biome mix, overlays, encounter/shop/settlement flags
- [ ] `sectionGenerator.ts` should accept typed content from the registry and return pure data, not JSX or database rows.
- [ ] Store exact entrance/exit coordinates on generated connections.
- [ ] Generate adjacent preview stubs from exits but do not auto-lock them.
- [ ] Run: `npm run test -- sectionGenerator`
- [ ] Expected: deterministic section tests pass and all hard constraints from the spec are covered.

## Task 5: Build The Render Payload Adapter For The Play Shell

**Files:**
- Create: `src/procgen/map/buildSectionRenderPayload.ts`
- Create: `src/procgen/integration/mapAdapter.ts`
- Modify: `src/types/index.ts`
- Modify: `src/components/map/MapCanvas.tsx`
- Modify: `src/stores/mapStore.ts`
- Test: `src/procgen/__tests__/mapAdapter.test.ts`

- [ ] Introduce a `SectionRenderPayload` that can describe floor tiles, walls, doors, hazards, objects, and atmosphere without depending on uploaded image maps.
- [ ] Extend the existing `Map` type carefully so a map surface can be either:
  - uploaded image-backed
  - generated section-backed
- [ ] Do not remove support for uploaded maps.
- [ ] Treat the generated render path as the runtime play shell for DunGEN, not the GM prep surface.
- [ ] Add failing tests for the adapter:
  - generated section payload converts into a canvas-consumable structure
  - grid math remains compatible with existing token movement
  - missing visual layers degrade gracefully
- [ ] Update `MapCanvas.tsx` to branch on map source type and render the generated payload path.
- [ ] Keep fog, tokens, and drawings working on generated sections.
- [ ] Run: `npm run test -- mapAdapter`
- [ ] Run: `npm run build`
- [ ] Expected: build passes and uploaded maps still render unchanged.

## Task 6: Load And Persist Procgen Campaign State In The Session Layer

**Files:**
- Create: `src/stores/procgenStore.ts`
- Create: `src/hooks/useProcgenCampaign.ts`
- Create: `src/hooks/useProcgenContent.ts`
- Modify: `src/hooks/useSession.ts`
- Modify: `src/hooks/useMap.ts`

- [ ] Add a dedicated `procgenStore` instead of overloading `mapStore` with campaign graph state.
- [ ] Keep `mapStore` focused on active map surface, viewport, selection, and fog tool state.
- [ ] `useProcgenCampaign.ts` should own:
  - create campaign
  - load campaign
  - preview section
  - lock section
  - reroll room/section scopes
  - apply GM overrides
- [ ] Update `useSession.ts` so joining a session can also load an attached procedural campaign if one exists.
- [ ] Do not auto-create a campaign for legacy sessions.
- [ ] Add optimistic local updates only where a failed persistence write can be cleanly rolled back.
- [ ] Run: `npm run build`
- [ ] Expected: legacy sessions still load without a procgen campaign.

## Task 7: Add `/DunGEN` Campaign UI And Launch Flow

**Files:**
- Create: `src/components/gm/ProcgenModeToggle.tsx`
- Create: `src/components/gm/ProcgenCampaignManager.tsx`
- Create: `src/components/dungen/DunGENCampaignView.tsx`
- Create: `src/components/dungen/DunGENHistoryPanel.tsx`
- Create: `src/components/dungen/DunGENLaunchBar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/gm/GMPanel.tsx`
- Modify: `src/components/gm/MapManager.tsx`
- Modify: `src/components/play/PlaySession.tsx`

- [ ] Build DunGEN as a dedicated route flow, not just a tab in the current GM panel.
- [ ] Keep the old uploaded map manager available for classic sessions.
- [ ] `DunGENCampaignView.tsx` and `ProcgenCampaignManager.tsx` should support:
  - create campaign from seed
  - select tone and difficulty
  - choose starting section or starter village
  - list existing sections and lock states
- [ ] Add launch flow from `/DunGEN` into `/play` so the GM can run a locked/generated section at the table.
- [ ] Add a campaign history panel in the DunGEN route, even if the first version is simple and text-first.
- [ ] Keep the first version text-heavy and functional. Do not spend time on ornamental UI before the engine is stable.
- [ ] Run: `npm run build`
- [ ] Expected: GM can manage a procedural campaign from `/DunGEN` without breaking classic map mode.

## Task 8: Add Section And Room Panels For Preview, Lock, Reveal, And Reroll

**Files:**
- Create: `src/components/gm/ProcgenSectionPanel.tsx`
- Create: `src/components/gm/ProcgenRoomPanel.tsx`
- Modify: `src/components/gm/GMPanel.tsx`
- Modify: `src/components/map/MapCanvas.tsx`

- [ ] `ProcgenSectionPanel.tsx` should show:
  - section name
  - biome
  - layout type
  - entrances/exits
  - adjacent preview sections
  - encounter density
  - settlement summary
  - lock/reroll controls
- [ ] `ProcgenRoomPanel.tsx` should show:
  - room primitive
  - room type
  - biome
  - overlays
  - hazards
  - NPC/shop/encounter summary
  - scoped reroll actions
- [ ] Respect lock rules: once locked, hide destructive rerolls unless the GM enters explicit override flow.
- [ ] Implement reroll scopes as API/store actions, not one-off UI mutations.
- [ ] Ensure adjacent preview sections become visible to GM before players.
- [ ] Run: `npm run build`
- [ ] Expected: GM can inspect and manage generated content without editing raw JSON.

## Task 9: Bind Generated Entities To Existing Token And NPC Systems

**Files:**
- Create: `src/procgen/integration/tokenBindings.ts`
- Modify: `src/types/index.ts`
- Modify: `src/stores/mapStore.ts`
- Modify: `src/components/map/MapCanvas.tsx`
- Modify: `src/components/gm/NPCManager.tsx`
- Test: `src/procgen/__tests__/tokenBindings.test.ts`

- [ ] Add a distinct canonical entity ID for generated NPCs/creatures and keep displayed token names editable.
- [ ] Do not let token label edits overwrite canonical entity IDs.
- [ ] Add bindings from section content to token spawn suggestions.
- [ ] Allow the GM to accept, ignore, hide, or manually replace suggested tokens.
- [ ] Include shared asset references in entity bindings so identical entities can reuse art across campaigns.
- [ ] Write tests that cover:
  - same generated NPC seed keeps stable canonical ID
  - display name changes do not mutate canonical identity
  - dead/looted/modified state persists separately from presentation
- [ ] Run: `npm run test -- tokenBindings`
- [ ] Expected: generated entities coexist with hand-placed NPC templates and current player tokens.

## Task 10: Add Export/Import And Campaign Persistence Safeguards

**Files:**
- Modify: `src/components/gm/SessionExport.tsx`
- Modify: `src/types/index.ts`
- Create: `src/procgen/state/exportImport.ts`

- [ ] Extend session export to include procedural campaign metadata, world seed, locked sections, overrides, and optionally generated render payload caches.
- [ ] Keep import backward-compatible with sessions that only contain classic uploaded maps.
- [ ] Export canonical procgen state separately from transient session presentation state where possible.
- [ ] Add a version field for procedural exports from day one.
- [ ] Run: `npm run build`
- [ ] Expected: classic export/import remains intact.

## Task 11: Fill In The Missing Content Packs With Thin, Typed Starter Data

**Files:**
- Create: `DunGEN/room_primitives.json`
- Create: `DunGEN/room_type_library.json`
- Create: `DunGEN/section_layout_presets.json`
- Create: `DunGEN/shop_types.json`
- Create: `DunGEN/object_prefabs.json`
- Create: `DunGEN/hazard_templates.json`
- Create: `DunGEN/tile_palettes.json`
- Create: `DunGEN/loot_tables.json`

- [ ] Add only the minimum viable content required for a playable first pass.
- [ ] Start with a narrow content slice:
  - `stone_halls`
  - `fungal_warrens`
  - `waystop`
  - 3-5 room primitives
  - 4-6 room types
  - 2 shop types
  - 3 hazards
  - 1 tile palette per initial biome
- [ ] Do not try to fill the full schema catalog before the engine proves the structure.
- [ ] Keep file formats consistent with the registry’s canonical in-memory shapes.
- [ ] Validate every new pack through the content registry tests.

## Task 12: Add Optional AI Flavor Hooks Only After Core Flow Works

**Files:**
- Create: `src/procgen/ai/promptBuilders.ts`
- Modify: `src/procgen/engine/entityGenerator.ts`
- Modify: `DunGEN/genai_description_schema.json`
- Create: `DunGEN/portrait_prompt_schema.json`
- Create: `DunGEN/room_flavor_prompt_schema.json`
- Create: `DunGEN/shop_flavor_prompt_schema.json`

- [ ] Keep AI prompt generation optional and side-effect free.
- [ ] Restrict AI usage to flavor text and portrait prompts.
- [ ] Do not let AI define room geometry, section graph connectivity, or canonical seed outputs.
- [ ] If automated image generation is added, only trigger background generation for locked content whose shared asset key is missing.
- [ ] Gate AI-triggered UI behind explicit GM action.
- [ ] Run: `npm run build`
- [ ] Expected: the procedural mode remains fully usable with AI disabled.

## Rollout Order

1. Ship Milestone 1 first and keep it invisible to players.
2. Ship Milestone 2 with developer-only or GM-only access.
3. Ship Milestone 3 as the first actually playable procedural slice.
4. Ship Milestone 4 only after two or three full test sessions confirm the core loop holds up.

## Definition Of Done For First Playable Slice

- GM can create a seeded campaign from `/DunGEN`.
- GM can generate and preview a section.
- GM can lock a section and reveal it to players.
- The section launches from `/DunGEN` into `/play` and renders without a static uploaded image.
- Tokens, fog, chat, dice, and drawings still work.
- Adjacent sections can be previewed by the GM.
- Generated NPC names remain editable without losing canonical identity.
- Shared asset references exist even if automated art generation is not turned on yet.
- Rejoining the session reloads the same locked section state.

## Risks To Watch

- The current `maps` table is image-centric. Do not contort canonical procgen state to fit it.
- Mixing canonical world state into `mapStore` will create hard-to-debug session leaks.
- If room geometry and room semantics are merged, reroll scopes will become painful very quickly.
- If content file naming is normalized by mass renaming first, early implementation will stall on repo churn instead of engine work.
- If AI gets introduced before deterministic generation is stable, debugging will become much harder.

## Suggested Commit Boundaries

- `test: add procgen vitest harness and seed tests`
- `feat: add procgen content registry and schema aliases`
- `feat: add procedural campaign persistence schema`
- `feat: implement deterministic section generation`
- `feat: render generated sections on map canvas`
- `feat: add gm procedural campaign controls`
- `feat: bind generated entities to token system`
- `feat: add procedural campaign export support`
- `feat: add starter dungeon content packs`
- `feat: add optional ai flavor prompt builders`

## Notes For Whoever Executes This

- Favor additive changes and adapters over destructive rewrites.
- Keep the classic uploaded-map mode working at every checkpoint.
- The first useful version is not the full spec. It is a narrow, stable, seeded loop with one or two biomes and enough content to prove the architecture.
- Every milestone should leave the repo in a buildable state.
