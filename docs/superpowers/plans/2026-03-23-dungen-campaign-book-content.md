# DunGEN Campaign Book Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand DunGEN from summary-level section content into a structured campaign-book system with narrative entries, persistent NPC entities, category-based rerolls, and a richer GM-facing book UI, while keeping all of it local/state-backed for now instead of persisting preview churn to Supabase.

**Architecture:** Keep structured content canonical in `src/procgen`, and treat narrative prose, NPC roleplay notes, encounters, shops, items, hazards, and hooks as typed campaign-book entries rather than one opaque prose blob. Split persistent NPC identity from section-specific appearances, generate all section book content deterministically from current packs and seeds, and evolve the `DunGENCampaignView` into a segmented GM reference surface with per-entry status and reroll actions.

**Tech Stack:** React 18, TypeScript, Zustand, Vite, Vitest, existing DunGEN JSON packs in `DunGEN`, local procgen campaign state in `src/stores/procgenStore.ts`.

---

## References

- Spec: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/specs/2026-03-23-dungen-campaign-book-content-design.md`
- Existing DunGEN design: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/specs/2026-03-21-dungen-content-first-design.md`
- Existing implementation plan: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/plans/2026-03-21-procedural-dungeon-campaign-mode.md`

## Current Baseline

- Section content is generated in `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/sectionContentGenerator.ts`
- Campaign-book UI lives in `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/dungen/DunGENCampaignView.tsx`
- Procgen content and render types live in `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/types.ts`
- Campaign state orchestration lives in `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/campaignFlow.ts`
- Procgen world/session state is held locally in `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/stores/procgenStore.ts`

## File Structure

### Create

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/campaignBookGenerator.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/npcEntityGenerator.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/sectionNarrativeGenerator.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/campaignBookGenerator.test.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/npcEntityGenerator.test.ts`

### Modify

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/types.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/types/index.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/sectionContentGenerator.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/campaignFlow.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/dungen/DunGENCampaignView.tsx`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/dungen-campaign-view.test.tsx`

## Task 1: Define Campaign-Book Entry And Persistent NPC Types

**Files:**
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/types.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/types/index.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/campaignBookGenerator.test.ts`

- [ ] **Step 1: Write the failing type-level and shape assertions**

Add a new test file that asserts the generated campaign-book payload supports:
- entry types like `read_aloud_intro`, `npc_profile`, `encounter_seed`, `shop_seed`, `item_seed`, `hook_seed`
- entry statuses `suggested`, `accepted`, `crossed_out`, `gm_added`
- persistent NPC entities separate from section-local appearances

- [ ] **Step 2: Run the new test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/campaignBookGenerator.test.ts`
Expected: FAIL because the new campaign-book types and generators do not exist yet.

- [ ] **Step 3: Add minimal canonical types**

Add these types in `src/procgen/types.ts`:
- `CampaignBookEntryType`
- `CampaignBookEntryStatus`
- `GeneratedCampaignBookEntry`
- `GeneratedCampaignBook`
- `GeneratedNpcEntity`
- `GeneratedNpcAppearance`

Mirror any needed store-facing record types in `src/types/index.ts` only where the existing procgen snapshot types require them. Do not add Supabase persistence fields yet.

- [ ] **Step 4: Re-run the type-oriented test**

Run: `npm run test:run -- src/procgen/__tests__/campaignBookGenerator.test.ts`
Expected: PASS on shape/type assertions that don’t require full content generation yet.

- [ ] **Step 5: Commit**

```bash
git add src/procgen/types.ts src/types/index.ts src/procgen/__tests__/campaignBookGenerator.test.ts
git commit -m "feat: add campaign book content types"
```

## Task 2: Generate Persistent NPC Entities And Section Appearances

**Files:**
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/npcEntityGenerator.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/sectionContentGenerator.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/npcEntityGenerator.test.ts`

- [ ] **Step 1: Write the failing NPC generator tests**

Cover:
- settlement sections generate persistent NPC entities with stable IDs
- section content references NPC appearances rather than only flat NPC summaries
- generated NPCs include roleplay-ready fields like backstory seed, motivation, secret, and disposition

- [ ] **Step 2: Run the NPC test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/npcEntityGenerator.test.ts`
Expected: FAIL because the NPC entity generator does not exist.

- [ ] **Step 3: Implement minimal NPC entity generation**

In `npcEntityGenerator.ts`, generate:
- canonical NPC entity ID from seed + role + section context
- stable name
- role
- backstory seed line
- roleplay note seed
- motivation
- secret
- disposition

Then update `sectionContentGenerator.ts` so settlement sections return:
- `npcEntities`
- `npcAppearances`
- campaign-book-compatible NPC profile data

- [ ] **Step 4: Re-run the NPC generator tests**

Run: `npm run test:run -- src/procgen/__tests__/npcEntityGenerator.test.ts`
Expected: PASS

- [ ] **Step 5: Run the existing content tests as a regression check**

Run: `npm run test:run -- src/procgen/__tests__/mapAdapter.test.ts src/procgen/__tests__/campaignFlow.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/procgen/engine/npcEntityGenerator.ts src/procgen/engine/sectionContentGenerator.ts src/procgen/__tests__/npcEntityGenerator.test.ts
git commit -m "feat: add persistent npc entity generation"
```

## Task 3: Generate Structured Campaign-Book Entries

**Files:**
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/campaignBookGenerator.ts`
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/sectionNarrativeGenerator.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/sectionContentGenerator.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/campaignBookGenerator.test.ts`

- [ ] **Step 1: Expand the failing campaign-book tests**

Add assertions that a generated section now produces:
- one `read_aloud_intro`
- one or more `area_impression` entries
- NPC profile and roleplay-note entries when NPCs exist
- encounter, creature, shop, hazard, item, and hook entries
- all entries begin in `suggested` status

- [ ] **Step 2: Run the campaign-book test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/campaignBookGenerator.test.ts`
Expected: FAIL because structured entry generation is not implemented.

- [ ] **Step 3: Implement the narrative and campaign-book generators**

In `sectionNarrativeGenerator.ts`, produce deterministic narrative seeds for:
- opening read-aloud intro
- area impression
- possible scene descriptions

In `campaignBookGenerator.ts`, compile all generated section content into typed entries:
- `read_aloud_intro`
- `area_impression`
- `room_scene`
- `npc_profile`
- `npc_roleplay_note`
- `encounter_seed`
- `creature_seed`
- `shop_seed`
- `item_seed`
- `hazard_seed`
- `hook_seed`

Then update `sectionContentGenerator.ts` to return:
- prior structured content arrays where still useful
- a new `campaignBook` payload as the canonical GM-facing content surface

- [ ] **Step 4: Re-run the campaign-book tests**

Run: `npm run test:run -- src/procgen/__tests__/campaignBookGenerator.test.ts`
Expected: PASS

- [ ] **Step 5: Run the broader procgen suite**

Run: `npm run test:run -- src/procgen/__tests__/mapAdapter.test.ts src/procgen/__tests__/campaignFlow.test.ts src/procgen/__tests__/navigationPolicy.test.ts src/procgen/__tests__/npcEntityGenerator.test.ts src/procgen/__tests__/campaignBookGenerator.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/procgen/engine/campaignBookGenerator.ts src/procgen/engine/sectionNarrativeGenerator.ts src/procgen/engine/sectionContentGenerator.ts src/procgen/__tests__/campaignBookGenerator.test.ts
git commit -m "feat: add structured campaign book generation"
```

## Task 4: Add Campaign-Book Entry Status And Scoped Reroll State

**Files:**
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/campaignFlow.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/types.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/campaignFlow.test.ts`

- [ ] **Step 1: Add failing tests for campaign-book entry state**

Cover:
- new book entries start as `suggested`
- crossing out an entry changes only that entry status
- rerolling narrative or encounters replaces only that slice’s entries
- crossed-out history remains visible in the resulting section content

- [ ] **Step 2: Run the campaign-flow test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/campaignFlow.test.ts`
Expected: FAIL on missing campaign-book status transitions.

- [ ] **Step 3: Implement local campaign-book state transitions**

In `campaignFlow.ts`, add helpers to:
- cross out a preview or section entry
- accept an entry
- reroll a category while preserving unrelated entry state

Keep this local/store-backed only. Do not add Supabase persistence.

- [ ] **Step 4: Re-run the campaign-flow test**

Run: `npm run test:run -- src/procgen/__tests__/campaignFlow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/procgen/engine/campaignFlow.ts src/procgen/types.ts src/procgen/__tests__/campaignFlow.test.ts
git commit -m "feat: add campaign book entry state controls"
```

## Task 5: Rework The Campaign Book UI Into Segmented Content Tabs

**Files:**
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/dungen/DunGENCampaignView.tsx`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/dungen-campaign-view.test.tsx`

- [ ] **Step 1: Write failing UI tests for segmented campaign-book rendering**

Cover:
- campaign book shows category tabs or segmented sections
- narrative entries render under `Narrative`
- NPC entries render under `NPCs`
- encounter entries render under `Encounters`
- `Cross Out` and `Accept` controls appear on campaign-book cards
- preview sections and visited sections both render campaign-book entries

- [ ] **Step 2: Run the view test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/dungen-campaign-view.test.tsx`
Expected: FAIL because the current sidebar is still summary-stack oriented.

- [ ] **Step 3: Implement the segmented campaign-book UI**

In `DunGENCampaignView.tsx`:
- replace the long stacked section summary with category-based rendering
- show structured entry cards with title, prose, metadata, status, and actions
- keep `Upcoming Previews` scoped to the current active section
- keep book focus separate from the broader world graph, but allow section selection to drive the rendered book content

Do not add freeform GM notes yet.

- [ ] **Step 4: Re-run the view test**

Run: `npm run test:run -- src/procgen/__tests__/dungen-campaign-view.test.tsx`
Expected: PASS

- [ ] **Step 5: Manual browser verification**

Run: `npm run dev`

Verify in `/DunGEN`:
- the campaign book reads like a real GM reference surface
- entries can be crossed out without disappearing
- previews and visited sections both show structured content
- section tabs still switch current active section and preview list correctly

- [ ] **Step 6: Commit**

```bash
git add src/components/dungen/DunGENCampaignView.tsx src/procgen/__tests__/dungen-campaign-view.test.tsx
git commit -m "feat: add segmented campaign book ui"
```

## Task 6: Add AI Placeholder Slots To Campaign-Book Entries And Entities

**Files:**
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/types.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/engine/campaignBookGenerator.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/dungen/DunGENCampaignView.tsx`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen/__tests__/campaignBookGenerator.test.ts`

- [ ] **Step 1: Add failing tests for AI placeholder support**

Cover:
- campaign-book entries can expose explicit placeholder blocks such as `[AI Generated intro goes here]`
- NPC and creature entries can expose portrait or token placeholder slots
- placeholders do not block the structured content from rendering

- [ ] **Step 2: Run the campaign-book test to verify it fails**

Run: `npm run test:run -- src/procgen/__tests__/campaignBookGenerator.test.ts`
Expected: FAIL because placeholder slot metadata is not yet present.

- [ ] **Step 3: Implement placeholder-first AI slots**

Add optional slot metadata such as:
- `aiIntroSlot`
- `aiProseSlot`
- `aiPortraitSlot`
- `aiTokenArtSlot`

Render clear placeholder blocks in the campaign book where appropriate, without adding actual AI generation yet.

- [ ] **Step 4: Re-run the campaign-book test**

Run: `npm run test:run -- src/procgen/__tests__/campaignBookGenerator.test.ts`
Expected: PASS

- [ ] **Step 5: Final verification**

Run:

```bash
npm run test:run -- src/procgen/__tests__/mapAdapter.test.ts src/procgen/__tests__/campaignFlow.test.ts src/procgen/__tests__/navigationPolicy.test.ts src/procgen/__tests__/npcEntityGenerator.test.ts src/procgen/__tests__/campaignBookGenerator.test.ts src/procgen/__tests__/dungen-campaign-view.test.tsx
npm run build
```

Expected:
- procgen suite passes
- build passes

- [ ] **Step 6: Commit**

```bash
git add src/procgen/types.ts src/procgen/engine/campaignBookGenerator.ts src/components/dungen/DunGENCampaignView.tsx src/procgen/__tests__/campaignBookGenerator.test.ts
git commit -m "feat: add ai placeholder slots for campaign book"
```

## Notes

- Do not add Supabase persistence in this plan.
- Do not add freeform GM notes in this plan.
- Do not bind encounters to exact room placement in this plan.
- Do not add the standalone custom map-generator UI in this plan.

## Manual Acceptance Checklist

- `/DunGEN` shows a campaign-book surface that feels like a GM reference page, not just a debug summary
- NPCs have names, motivations, secrets, and roleplay-ready notes
- campaign-book entries are suggestions, not prescriptions
- entries can be accepted or crossed out
- crossed-out entries remain visible as campaign history
- AI placeholder blocks are visible but optional
- switching between visited sections still keeps the overview and preview behavior coherent
