# VTT and Endless Dungeon Repo Separation Design

## Goal

Separate Endless Dungeon from StormlightVTT into its own standalone repository so the main Stormlight repo becomes a pure VTT product again.

The priority is protecting and simplifying the VTT, not preserving embedded product coupling or maintaining git history for the extracted Endless Dungeon work.

## Decision Summary

Recommended approach: hard extraction with a staging repository.

That means:

- create a brand-new Endless Dungeon repository from a curated copy of the current DunGEN-related code
- verify the copied code exists safely outside the Stormlight repo
- remove all Endless Dungeon code and product framing from StormlightVTT
- do not build a runtime bridge, shared package, or API integration in this phase

This is intentionally a cold separation.

After the split:

- StormlightVTT owns only live-table VTT workflows
- Endless Dungeon owns all procedural campaign generation and campaign-surface workflows
- any future connection between the two products is deferred until the VTT is stable

## Product Boundary

### StormlightVTT after separation

StormlightVTT should present and implement only:

- session create and join
- session lobby and play flows
- maps and token interaction
- chat, dice, drawing, fog, and GM controls
- admin workflows
- shared asset workflows that are genuinely useful to the VTT on their own

The Stormlight repo should not contain:

- Endless Dungeon landing or launch flows
- procedural campaign generation state
- DunGEN-specific campaign persistence
- campaign-book generation
- baked biome-floor generation logic that only exists to support DunGEN
- DunGEN-specific product copy in the home or play entry surfaces

### Endless Dungeon after separation

The new Endless Dungeon repo should own:

- procedural campaign generation
- DunGEN campaign UI
- procedural content packs
- campaign progression logic
- campaign-book generation
- section bake and render preparation
- any product framing that treats the VTT as a downstream runtime concept

The new repo does not need to be architecturally perfect in phase 1.

It is acceptable for the new Endless Dungeon repo to temporarily contain copied VTT-oriented shell code if that is the fastest way to isolate the product safely. The cleanup burden belongs in the new repo, not in StormlightVTT.

## Non-Goals

This phase explicitly does not include:

- preserving git history across repositories
- building a shared package between the repos
- designing or implementing a live API bridge
- keeping a launch button or placeholder route in StormlightVTT
- optimizing the Endless Dungeon repo into a final long-term architecture

## Why This Approach

### Option selected

Hard extraction with a staging repository is the best fit for the current priorities because it protects the main VTT from further coupling while still preserving the DunGEN work in a safe place before anything is deleted.

### Why not leave a bridge in Stormlight

Leaving an in-app bridge or placeholder integration would keep Stormlight mentally and structurally tied to DunGEN. That is exactly what this split is trying to undo.

### Why not preserve git history

Git history preservation adds process complexity without helping the immediate product goal. The important artifact is the code and content itself, not ancestry continuity.

### Why not build integration now

Any integration work now would pull the repo split back toward a shared-system design. The current product goal is the opposite: make Stormlight easier to stabilize by removing DunGEN concerns entirely.

## Current Coupling Inventory

The separation work must account for the fact that Endless Dungeon is not a single folder or route. It currently spans product framing, UI, engine code, persistence, tests, assets, and documentation.

### Primary DunGEN-owned areas

- `DunGEN/`
- `src/components/dungen/`
- `src/procgen/`
- `src/stores/procgenStore.ts`
- `src/hooks/useProcgenCampaign.ts`
- `supabase/migrations/003_procgen_campaign_mode.sql`

### Main product entry points that currently surface DunGEN

- `src/App.tsx`
- `src/components/session/Home.tsx`
- `src/components/play/PlayEntryHub.tsx`
- `src/components/play/PlayLaunchGate.tsx`

### Likely additional coupling areas

- type definitions in `src/types/index.ts`
- tests under `src/procgen/__tests__/`
- session-flow behavior that treats `/campaign` or `/DunGEN` as a special mode
- docs and plans that position Stormlight as a combined VTT and procedural campaign product
- public assets that only exist for procgen map rendering

## Target Extraction Rules

### Rule 1: copy first, delete second

No DunGEN-owned code should be deleted from StormlightVTT until it exists in the new repository.

### Rule 2: optimize for VTT clarity, not code reuse

If a file is ambiguous, the deciding question is:

"Does this belong in a pure VTT product even if Endless Dungeon never reconnects?"

If the answer is no, it should move out of Stormlight.

### Rule 3: prefer duplication over shared abstractions

If a utility is currently shared only because DunGEN was built inside the VTT repo, duplication is acceptable during extraction. Shared abstractions can be revisited later when the products reconnect intentionally.

### Rule 4: remove all user-facing DunGEN framing from Stormlight

A user opening StormlightVTT after the split should see a single-product VTT, not a VTT with traces of a removed second mode.

## Proposed File Ownership

### Move to the new Endless Dungeon repo

- all files under `DunGEN/`
- all files under `src/components/dungen/`
- all files under `src/procgen/`
- `src/stores/procgenStore.ts`
- `src/hooks/useProcgenCampaign.ts`
- procgen-only tests
- procgen-only supporting docs and plans
- procgen schema and migration files

### Remove from Stormlight and do not replace

- `/campaign` route
- legacy `/DunGEN` route aliases
- Endless Dungeon CTA buttons
- Endless Dungeon launch gate copy and screens
- special session hydration behavior that only exists for campaign-mode navigation

### Keep in Stormlight

- classic session and play flows
- VTT stores, hooks, and components not required by DunGEN extraction
- admin and asset-management features that still support the VTT directly
- base app shell and routing, after DunGEN routes are removed

### Evaluate case-by-case during extraction

- shared UI atoms used by both sides
- any map adapter code that may be useful for generic VTT map import versus DunGEN-specific rendering
- public assets referenced by both products
- type definitions that currently mix VTT and procgen models in a single file

These files should be assigned based on whether they still make sense in a DunGEN-free VTT.

## Migration Plan

### Phase 1: inventory and extraction manifest

Create an explicit manifest of DunGEN-owned files and Stormlight-owned files before touching implementation.

Outputs:

- a copy list for the new Endless Dungeon repo
- a delete list for StormlightVTT
- a review list for ambiguous files

Success criteria:

- the team can point to a concrete extraction set instead of relying on memory

### Phase 2: bootstrap the new Endless Dungeon repository

Create a fresh repository and copy the DunGEN-owned code into it.

In this phase, favor completeness over elegance:

- copy the DunGEN app surface
- copy directly required support code
- copy required tests and content packs
- get the repo into a state where it can be iterated on independently

Success criteria:

- all DunGEN-owned source exists outside StormlightVTT
- the new repo is no longer dependent on the Stormlight repo continuing to host the code

### Phase 3: remove DunGEN from StormlightVTT

Once the copied code is safe in the new repo:

- remove DunGEN routes and aliases
- remove DunGEN UI and product copy
- delete procgen engine code
- delete procgen stores and hooks
- delete procgen tests
- delete procgen migrations and docs that no longer belong in the VTT repo
- simplify routing and session-flow logic that was introduced for campaign mode

Success criteria:

- Stormlight no longer imports, references, or advertises Endless Dungeon

### Phase 4: VTT repair and simplification

After deletion, repair any fallout:

- resolve broken imports
- simplify conditional logic that existed only for campaign mode
- collapse dead code paths
- update README and setup docs to describe a VTT-only product

Success criteria:

- the repo is easier to understand than before the split

## Verification Gates

### StormlightVTT verification

StormlightVTT is considered successfully separated only if all of the following are true:

- application build passes
- test suite for remaining VTT code passes
- home flow is VTT-only
- create, join, lobby, and play flows still work
- no remaining `dungen` or `procgen` imports exist in live Stormlight code unless intentionally retained as generic VTT logic
- no remaining Endless Dungeon copy appears in user-facing screens
- README and setup docs describe a VTT-only product

### Endless Dungeon verification

The new Endless Dungeon repo does not need to be production-ready in this phase.

It only needs to be safely preserved and independently iteratable:

- DunGEN source and content are present
- the repo has the minimum configuration needed for continued work
- follow-up cleanup can happen without relying on StormlightVTT

## Risk Areas

### Hidden type coupling

Procgen types may currently live beside core VTT types. Removing procgen can break unrelated files if type boundaries are not cleaned carefully.

Mitigation:

- audit imports from `src/types/index.ts`
- split or delete procgen-specific types instead of leaving dead mixed models behind

### Session-flow special cases

The main app currently detects campaign routes and changes behavior accordingly.

Mitigation:

- remove campaign-route conditionals when DunGEN routes are deleted
- verify session rejoin and hydration still behave correctly in the simplified VTT

### Asset and rendering spillover

Some bake or floor assets may have been placed in general-purpose public or rendering folders.

Mitigation:

- trace actual references before deletion
- keep only assets that support the remaining VTT product directly

### Documentation drift

The repo README and product docs may still describe a dual-product system after the code is removed.

Mitigation:

- treat docs cleanup as part of separation, not optional polish

## Future Integration Seam

No integration work will be built now.

However, the split should leave a clean conceptual seam for later:

- campaign snapshot or campaign state export
- rendered map payload or map import package
- session bootstrap request from Endless Dungeon into a future VTT API

These are documentation-level concepts only for now. They should not appear as code, routes, stubs, or placeholders in StormlightVTT during this phase.

## Recommended Execution Order

1. Inventory DunGEN-owned files and dependencies.
2. Copy DunGEN-owned code into a fresh repository.
3. Confirm the copied code is safely outside Stormlight.
4. Remove all DunGEN product entry points from Stormlight.
5. Delete procgen implementation, tests, docs, and schema from Stormlight.
6. Repair and simplify the remaining VTT app.
7. Run build and test verification for the VTT-only repo.
8. Update product docs to reflect the narrowed scope.

## Success Definition

This separation is successful when:

- StormlightVTT can be worked on as a bullet-proof VTT without thinking about Endless Dungeon
- Endless Dungeon can be worked on in a separate repository without relying on StormlightVTT to host its code
- neither product contains fake integration placeholders pretending they are still one system

That outcome is more important than elegance inside the newly extracted Endless Dungeon repo.
