# VTT and Endless Dungeon Repo Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Endless Dungeon into a separate standalone repo while turning StormlightVTT back into a VTT-only application with no DunGEN routes, runtime glue, or product copy left behind.

**Architecture:** Preserve the Endless Dungeon code by copying it into a fresh sibling repository first, then delete every DunGEN-specific surface from StormlightVTT and simplify the remaining VTT codepaths. Treat the split as a cold separation: no shared package, no launch bridge, and no placeholder integration code in Stormlight after cleanup.

**Tech Stack:** Git worktrees, TypeScript, React 18, Vite, Vitest, Zustand, Supabase, Tailwind, ripgrep, standard shell file-copy tools

---

## Assumptions

- New standalone repo root: `/Users/nonomaybeyes/Documents/projects/EndlessDungeon`
- Working branch for Stormlight cleanup: `codex/vtt-only-dungen-extraction`
- The new Endless Dungeon repo may temporarily keep copied VTT shell code if needed to boot independently
- The Stormlight repo keeps the separation spec and implementation plan, but DunGEN-specific product docs move out with the extracted code

## File Structure

### StormlightVTT files that must stay and be simplified

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/App.tsx`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/session/Home.tsx`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlayEntryHub.tsx`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlayRoute.tsx`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useSession.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useRealtime.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useMap.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/MapCanvas.tsx`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/types/index.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/README.md`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/SETUP.md`

### Files and directories that move to the new Endless Dungeon repo

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/DunGEN`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/dungen`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/stores/procgenStore.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useProcgenCampaign.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useProcgenContent.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/supabase/migrations/003_procgen_campaign_mode.sql`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/supabase/migrations/004_shared_dungen_assets.sql`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/specs/2026-03-21-dungen-content-first-design.md`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/specs/2026-03-23-dungen-campaign-book-content-design.md`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/specs/2026-03-24-dungen-biome-map-generator-design.md`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/plans/2026-03-21-procedural-dungeon-campaign-mode.md`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/plans/2026-03-23-dungen-campaign-book-content.md`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/plans/2026-03-24-dungen-biome-map-generator.md`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/plans/2026-03-27-baked-walls-and-set-dressing.md`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/plans/2026-03-28-procedural-pixel-texture-pipeline.md`

### Files likely deleted outright from Stormlight after the copy

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlayLaunchGate.tsx`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/generatedFloorRender.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/generatedFloorRender.test.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/generatedWallRender.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/generatedWallRender.test.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/public/assets/DarkGrit-a.png`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/public/assets/DarkGrit-b.png`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/public/assets/DarkGrit-c.png`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/public/assets/DarkGrit-d.png`

### New Stormlight cleanup migration to create

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/supabase/migrations/013_remove_dungen_schema.sql`

### Supporting root files to copy into the new repo

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/package.json`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/package-lock.json`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/tsconfig.json`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/tsconfig.node.json`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/vite.config.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/vitest.config.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/index.html`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/postcss.config.js`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/tailwind.config.js`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/.gitignore`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/.env.example`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/public/_redirects`

### Case-by-case files to audit before deleting

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/__tests__/useSession.test.tsx`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlayRoute.test.tsx`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlaySession.test.tsx`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/MapCanvas.tsx`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/generatedWallRender.ts`
- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/types/index.ts`

## Task 1: Create an isolated worktree and extraction manifest

**Files:**
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/.worktrees/vtt-only-dungen-extraction`
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/temp/dungen-extraction-manifest.md`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/plans/2026-04-03-vtt-dungen-repo-separation.md`

- [ ] **Step 1: Create the worktree**

Run:

```bash
git worktree add .worktrees/vtt-only-dungen-extraction -b codex/vtt-only-dungen-extraction
```

Expected: a new worktree is created at `.worktrees/vtt-only-dungen-extraction` on branch `codex/vtt-only-dungen-extraction`

- [ ] **Step 2: Build the extraction manifest**

Create `/Users/nonomaybeyes/Documents/projects/StormlightVTT/temp/dungen-extraction-manifest.md` with three sections:

```md
# DunGEN Extraction Manifest

## Copy To Endless Dungeon Repo
- DunGEN/
- src/components/dungen/
- src/procgen/
- src/stores/procgenStore.ts
- src/hooks/useProcgenCampaign.ts
- src/hooks/useProcgenContent.ts
- supabase/migrations/003_procgen_campaign_mode.sql
- supabase/migrations/004_shared_dungen_assets.sql

## Delete From Stormlight After Copy
- src/components/play/PlayLaunchGate.tsx
- src/components/map/generatedFloorRender.ts
- src/components/map/generatedWallRender.ts
- public/assets/DarkGrit-a.png

## Audit Before Editing
- src/types/index.ts
- src/hooks/useSession.ts
- src/hooks/useRealtime.ts
- src/hooks/useMap.ts
- src/components/map/MapCanvas.tsx
```

- [ ] **Step 3: Verify the manifest covers all live references**

Run:

```bash
rg -n "procgen|dungen|DunGEN|generatedRenderPayload|generatedSectionId|launching=1" src supabase public README.md SETUP.md
```

Expected: every remaining hit is accounted for in either the copy list, delete list, or audit list

- [ ] **Step 4: Commit the manifest groundwork**

```bash
git add temp/dungen-extraction-manifest.md
git commit -m "chore: add dungen extraction manifest"
```

## Task 2: Bootstrap the standalone Endless Dungeon repo

**Files:**
- Create: `/Users/nonomaybeyes/Documents/projects/EndlessDungeon`
- Create: `/Users/nonomaybeyes/Documents/projects/EndlessDungeon/README.md`
- Create: `/Users/nonomaybeyes/Documents/projects/EndlessDungeon/.git`
- Copy: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/DunGEN`
- Copy: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/dungen`
- Copy: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen`
- Copy: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/stores/procgenStore.ts`
- Copy: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useProcgenCampaign.ts`
- Copy: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useProcgenContent.ts`
- Copy: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/shared`
- Copy: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/lib`
- Copy: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/types/index.ts`
- Copy: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/test/setup.ts`
- Copy: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/public`
- Copy: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/supabase/migrations/003_procgen_campaign_mode.sql`
- Copy: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/supabase/migrations/004_shared_dungen_assets.sql`

- [ ] **Step 1: Create the new repo root and initialize git**

Run:

```bash
mkdir -p /Users/nonomaybeyes/Documents/projects/EndlessDungeon
git init /Users/nonomaybeyes/Documents/projects/EndlessDungeon
```

Expected: an empty git repo exists at `/Users/nonomaybeyes/Documents/projects/EndlessDungeon`

- [ ] **Step 2: Copy over the root scaffolding**

Run:

```bash
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/package.json /Users/nonomaybeyes/Documents/projects/EndlessDungeon/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/package-lock.json /Users/nonomaybeyes/Documents/projects/EndlessDungeon/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/tsconfig.json /Users/nonomaybeyes/Documents/projects/EndlessDungeon/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/tsconfig.node.json /Users/nonomaybeyes/Documents/projects/EndlessDungeon/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/vite.config.ts /Users/nonomaybeyes/Documents/projects/EndlessDungeon/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/vitest.config.ts /Users/nonomaybeyes/Documents/projects/EndlessDungeon/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/index.html /Users/nonomaybeyes/Documents/projects/EndlessDungeon/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/postcss.config.js /Users/nonomaybeyes/Documents/projects/EndlessDungeon/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/tailwind.config.js /Users/nonomaybeyes/Documents/projects/EndlessDungeon/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/.gitignore /Users/nonomaybeyes/Documents/projects/EndlessDungeon/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/.env.example /Users/nonomaybeyes/Documents/projects/EndlessDungeon/
```

Expected: the new repo has enough top-level config to install and run independently

- [ ] **Step 3: Copy the DunGEN-owned code and content**

Run:

```bash
mkdir -p /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/components
mkdir -p /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/hooks
mkdir -p /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/stores
mkdir -p /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/test
mkdir -p /Users/nonomaybeyes/Documents/projects/EndlessDungeon/supabase/migrations
cp -R /Users/nonomaybeyes/Documents/projects/StormlightVTT/DunGEN /Users/nonomaybeyes/Documents/projects/EndlessDungeon/
cp -R /Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/dungen /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/components/
cp -R /Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/src/stores/procgenStore.ts /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/stores/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useProcgenCampaign.ts /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/hooks/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useProcgenContent.ts /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/hooks/
cp -R /Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/shared /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/components/
cp -R /Users/nonomaybeyes/Documents/projects/StormlightVTT/src/lib /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/src/types/index.ts /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/types.ts
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/src/test/setup.ts /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/test/
cp -R /Users/nonomaybeyes/Documents/projects/StormlightVTT/public /Users/nonomaybeyes/Documents/projects/EndlessDungeon/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/supabase/migrations/003_procgen_campaign_mode.sql /Users/nonomaybeyes/Documents/projects/EndlessDungeon/supabase/migrations/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/supabase/migrations/004_shared_dungen_assets.sql /Users/nonomaybeyes/Documents/projects/EndlessDungeon/supabase/migrations/
```

Expected: the extracted code exists independently of StormlightVTT

- [ ] **Step 4: Add a bootstrap README in the new repo**

Create `/Users/nonomaybeyes/Documents/projects/EndlessDungeon/README.md` with:

```md
# Endless Dungeon

This repository contains the extracted DunGEN campaign-generation product separated from StormlightVTT.

Initial bootstrap status:
- code copied from StormlightVTT
- architecture cleanup still pending
- no live API integration with StormlightVTT yet
```

- [ ] **Step 5: Commit the new repo bootstrap**

```bash
git -C /Users/nonomaybeyes/Documents/projects/EndlessDungeon add .
git -C /Users/nonomaybeyes/Documents/projects/EndlessDungeon commit -m "chore: bootstrap endless dungeon from stormlight split"
```

## Task 3: Verify the new repo preserves the DunGEN work before deletion

**Files:**
- Modify: `/Users/nonomaybeyes/Documents/projects/EndlessDungeon/README.md`
- Test: `/Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/procgen/__tests__/campaignFlow.test.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/procgen/__tests__/dungen-campaign-view.test.tsx`

- [ ] **Step 1: Install dependencies in the new repo**

Run:

```bash
npm install
```

Workdir: `/Users/nonomaybeyes/Documents/projects/EndlessDungeon`

Expected: `node_modules` installs successfully using the copied `package-lock.json`

- [ ] **Step 2: Run a minimal extracted test set**

Run:

```bash
npm run test:run -- src/procgen/__tests__/campaignFlow.test.ts src/procgen/__tests__/dungen-campaign-view.test.tsx
```

Workdir: `/Users/nonomaybeyes/Documents/projects/EndlessDungeon`

Expected: tests either pass or fail only because of missing copied support files that are then added deliberately before any Stormlight deletion begins

- [ ] **Step 3: Record any missing support files and copy them now**

If the tests complain about missing dependencies, use targeted copies instead of broad repo duplication. Typical candidates:

```bash
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/generatedFloorRender.ts /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/components/map/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/generatedWallRender.ts /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/components/map/
cp /Users/nonomaybeyes/Documents/projects/StormlightVTT/src/main.tsx /Users/nonomaybeyes/Documents/projects/EndlessDungeon/src/
```

- [ ] **Step 4: Do not continue until the copied code is safe**

Run:

```bash
git -C /Users/nonomaybeyes/Documents/projects/EndlessDungeon status --short
```

Expected: all copied bootstrap changes are present in the new repo and can be committed independently

## Task 4: Remove DunGEN routes and public entry points from Stormlight

**Files:**
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/App.tsx`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/session/Home.tsx`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlayEntryHub.tsx`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlayRoute.tsx`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlayLaunchGate.tsx`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlayRoute.test.tsx`

- [ ] **Step 1: Write the failing route/UI test updates**

Update or add assertions so the tests expect a VTT-only experience:

```tsx
expect(screen.queryByText('Start Endless Dungeon')).not.toBeInTheDocument();
expect(screen.queryByText('Play Launch Gate')).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the route tests to confirm the old behavior still exists**

Run:

```bash
npm run test:run -- src/components/play/PlayRoute.test.tsx
```

Expected: FAIL because the current route layer still renders the launch gate or Endless Dungeon path

- [ ] **Step 3: Remove the DunGEN routes from `src/App.tsx`**

Replace the route section with the VTT-only shape:

```tsx
return (
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/play" element={<PlayRoute />} />
    <Route path="/create" element={<LegacyRouteAlias to="/play?mode=create"><SessionCreate /></LegacyRouteAlias>} />
    <Route path="/join" element={<LegacyRouteAlias to="/play?mode=join"><SessionJoin /></LegacyRouteAlias>} />
    <Route path="/lobby" element={<ProtectedRoute><SessionLobby /></ProtectedRoute>} />
    <Route path="/admin" element={<AdminLogin />} />
    <Route path="/admin/dashboard" element={<AdminDashboard />} />
    <Route path="/admin/assets/new" element={<AssetCreate />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
```

- [ ] **Step 4: Remove Endless Dungeon CTA copy from home and play entry**

Change the user-facing copy to a single-product VTT version. Example:

```tsx
<h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl tempest-heading">
  One fast path from session setup to the live table.
</h1>
```

and remove the campaign button from both entry surfaces.

- [ ] **Step 5: Simplify `PlayRoute`**

Delete the `launching=1` branch so the component becomes:

```tsx
if (shouldAutoJoin && !hasActiveAutoJoinTarget) {
  return <PlayAutoJoinGate />;
}

if (!session || !currentUser) {
  return <PlayEntryHub />;
}

return <PlaySession />;
```

- [ ] **Step 6: Re-run the route/UI tests**

Run:

```bash
npm run test:run -- src/components/play/PlayRoute.test.tsx
```

Expected: PASS

- [ ] **Step 7: Commit the route cleanup**

```bash
git add src/App.tsx src/components/session/Home.tsx src/components/play/PlayEntryHub.tsx src/components/play/PlayRoute.tsx src/components/play/PlayRoute.test.tsx
git rm src/components/play/PlayLaunchGate.tsx
git commit -m "refactor: remove endless dungeon entry points from vtt"
```

## Task 5: Remove procgen session, realtime, and map-selection glue from Stormlight

**Files:**
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useSession.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useRealtime.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useMap.ts`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useProcgenCampaign.ts`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useProcgenContent.ts`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/stores/procgenStore.ts`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/__tests__/useSession.test.tsx`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/__tests__/useRealtime.test.ts`

- [ ] **Step 1: Rewrite the session tests around uploaded-map-only behavior**

Remove generated campaign expectations and replace them with assertions like:

```tsx
expect(result?.activeMap?.generatedSectionId).toBeUndefined();
expect(result?.hasGeneratedCampaign).toBeUndefined();
```

If `buildGeneratedSessionMapState` becomes unnecessary, delete the related tests instead of preserving dead abstractions.

- [ ] **Step 2: Run the session and realtime tests to confirm procgen assumptions still fail**

Run:

```bash
npm run test:run -- src/hooks/__tests__/useSession.test.tsx src/hooks/__tests__/useRealtime.test.ts
```

Expected: FAIL because the current hooks still import procgen code and realtime tables

- [ ] **Step 3: Strip `useSession.ts` down to uploaded-map session loading**

Delete:

- `useProcgenStore`
- `useProcgenCampaign`
- `createSnapshotFromStore`
- `getMapBakeContentSignature`
- `loadMapBakeContent`
- `ensureSectionsHaveCurrentBakedFloors`
- `createGeneratedMapsFromSnapshot`
- `buildGeneratedSessionMapState`

The session loader should only load:

```ts
maps,
characters,
npc templates,
npc instances,
chat,
dice,
initiative
```

- [ ] **Step 4: Simplify `useRealtime.ts` to a single play mode**

Change the hook signature from:

```ts
export const useRealtime = (options?: { mode?: 'play' | 'campaign' }) => {
```

to:

```ts
export const useRealtime = () => {
```

Then remove:

- campaign-mode early return
- `procgen_campaigns` subscription
- local campaign storage subscription imports

- [ ] **Step 5: Simplify `useMap.ts`**

Delete the generated-section persistence branch:

```ts
if (shouldPersistActiveMapSelection(map)) {
  // keep sessions.active_map_id update
}
```

Then remove the procgen import and collapse `setMapActive` to standard map selection only.

- [ ] **Step 6: Re-run the hook tests**

Run:

```bash
npm run test:run -- src/hooks/__tests__/useSession.test.tsx src/hooks/__tests__/useRealtime.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit the runtime glue cleanup**

```bash
git add src/hooks/useSession.ts src/hooks/useRealtime.ts src/hooks/useMap.ts src/hooks/__tests__/useSession.test.tsx src/hooks/__tests__/useRealtime.test.ts
git rm src/hooks/useProcgenCampaign.ts src/hooks/useProcgenContent.ts src/stores/procgenStore.ts
git commit -m "refactor: remove procgen runtime glue from vtt"
```

## Task 6: Remove generated-map rendering branches and procgen types from Stormlight

**Files:**
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/MapCanvas.tsx`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/types/index.ts`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/generatedFloorRender.ts`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/generatedFloorRender.test.ts`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/generatedWallRender.ts`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/generatedWallRender.test.ts`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/procgen`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlaySession.test.tsx`

- [ ] **Step 1: Update the map/play tests to assume uploaded maps only**

Remove any shape that requires:

- `sourceType`
- `generatedSectionId`
- `generatedRenderPayload`

Use simpler test maps:

```ts
const map = {
  id: 'map_1',
  sessionId: 'session_1',
  name: 'Battle Map',
  imageUrl: '/map.png',
  width: 1000,
  height: 800,
  sortOrder: 0,
  createdAt: '2026-04-03T00:00:00.000Z',
  gridEnabled: true,
  gridOffsetX: 0,
  gridOffsetY: 0,
  gridCellSize: 50,
  gridColor: '#ffffff',
  fogEnabled: false,
  fogDefaultState: 'revealed',
  fogData: [],
  drawingData: [],
  effectsEnabled: false,
  effectData: [],
  showPlayerTokens: true,
};
```

- [ ] **Step 2: Run the play/map tests to confirm current procgen rendering still leaks in**

Run:

```bash
npm run test:run -- src/components/play/PlaySession.test.tsx src/components/map/generatedFloorRender.test.ts src/components/map/generatedWallRender.test.ts
```

Expected: FAIL or become irrelevant because the generated-render helpers are still wired into `MapCanvas`

- [ ] **Step 3: Simplify `src/types/index.ts`**

Remove the procgen imports and delete:

- `MapSourceType`
- `generatedSectionId`
- `generatedRenderPayload`
- all `CampaignWorld`, `DungeonSectionRecord`, `ProcgenSectionPreviewRecord`, `SharedAssetRecord`, and `DbProcgen*` types
- all `dbProcgen*` and `dbSharedAsset*` mappers

Keep `dbMapToMap` returning only uploaded-map fields.

- [ ] **Step 4: Simplify `MapCanvas.tsx`**

Delete all generated-map-specific branches:

- `normalizeSectionRenderPayload`
- `resolveFloorAsset`
- procgen type imports
- baked floor chunk rendering
- generated wall and hazard rendering
- generated grit overlay logic

After the edit, the map canvas should always render from `activeMap.imageUrl`.

- [ ] **Step 5: Delete the generated rendering helpers and procgen tree from Stormlight**

```bash
git rm src/components/map/generatedFloorRender.ts
git rm src/components/map/generatedFloorRender.test.ts
git rm src/components/map/generatedWallRender.ts
git rm src/components/map/generatedWallRender.test.ts
git rm -r src/procgen
```

- [ ] **Step 6: Re-run the play test**

Run:

```bash
npm run test:run -- src/components/play/PlaySession.test.tsx
```

Expected: PASS

- [ ] **Step 7: Commit the map/type cleanup**

```bash
git add src/components/map/MapCanvas.tsx src/types/index.ts src/components/play/PlaySession.test.tsx
git commit -m "refactor: remove generated map support from vtt"
```

## Task 7: Remove DunGEN docs, schema, assets, and stale product references from Stormlight

**Files:**
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/README.md`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/SETUP.md`
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/supabase/migrations/013_remove_dungen_schema.sql`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/DunGEN`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/supabase/migrations/003_procgen_campaign_mode.sql`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/supabase/migrations/004_shared_dungen_assets.sql`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/specs/2026-03-21-dungen-content-first-design.md`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/specs/2026-03-23-dungen-campaign-book-content-design.md`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/specs/2026-03-24-dungen-biome-map-generator-design.md`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/plans/2026-03-21-procedural-dungeon-campaign-mode.md`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/plans/2026-03-23-dungen-campaign-book-content.md`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/plans/2026-03-24-dungen-biome-map-generator.md`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/plans/2026-03-27-baked-walls-and-set-dressing.md`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/docs/superpowers/plans/2026-03-28-procedural-pixel-texture-pipeline.md`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/public/assets/DarkGrit-a.png`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/public/assets/DarkGrit-b.png`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/public/assets/DarkGrit-c.png`
- Delete: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/public/assets/DarkGrit-d.png`

- [ ] **Step 1: Create the database cleanup migration for existing Stormlight environments**

Create `/Users/nonomaybeyes/Documents/projects/StormlightVTT/supabase/migrations/013_remove_dungen_schema.sql`:

```sql
-- Remove Endless Dungeon / DunGEN schema from StormlightVTT.
-- Safe for upgrade runs after the repo split.

ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS procgen_section_previews;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS procgen_overrides;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS procgen_room_states;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS procgen_sections;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS procgen_campaigns;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS shared_assets;

DROP TRIGGER IF EXISTS update_procgen_section_previews_updated_at ON procgen_section_previews;
DROP TRIGGER IF EXISTS update_procgen_overrides_updated_at ON procgen_overrides;
DROP TRIGGER IF EXISTS update_procgen_room_states_updated_at ON procgen_room_states;
DROP TRIGGER IF EXISTS update_procgen_sections_updated_at ON procgen_sections;
DROP TRIGGER IF EXISTS update_procgen_campaigns_updated_at ON procgen_campaigns;
DROP TRIGGER IF EXISTS update_shared_assets_updated_at ON shared_assets;

DROP POLICY IF EXISTS "Allow all operations on procgen_section_previews" ON procgen_section_previews;
DROP POLICY IF EXISTS "Allow all operations on procgen_overrides" ON procgen_overrides;
DROP POLICY IF EXISTS "Allow all operations on procgen_room_states" ON procgen_room_states;
DROP POLICY IF EXISTS "Allow all operations on procgen_sections" ON procgen_sections;
DROP POLICY IF EXISTS "Allow all operations on procgen_campaigns" ON procgen_campaigns;
DROP POLICY IF EXISTS "Allow all operations on shared_assets" ON shared_assets;

DROP TABLE IF EXISTS procgen_section_previews CASCADE;
DROP TABLE IF EXISTS procgen_overrides CASCADE;
DROP TABLE IF EXISTS procgen_room_states CASCADE;
DROP TABLE IF EXISTS procgen_sections CASCADE;
DROP TABLE IF EXISTS procgen_campaigns CASCADE;
DROP TABLE IF EXISTS shared_assets CASCADE;
```

- [ ] **Step 2: Update the README to describe only the VTT**

Rewrite the high-level architecture and feature-area sections so they mention:

- session setup
- live tabletop play
- admin features
- Supabase-backed persistence

and do not mention:

- campaign route
- DunGEN
- generated campaign mode

- [ ] **Step 3: Update `SETUP.md` migration instructions**

Remove the procgen-specific migrations from the fresh-install list and add an upgrade note for existing projects:

```md
Existing Stormlight databases that previously enabled Endless Dungeon should also run:

13. `013_remove_dungen_schema.sql`
```

- [ ] **Step 4: Move or delete the DunGEN-specific docs**

Delete the DunGEN specs and plans from Stormlight after they have been copied into the new repo.

- [ ] **Step 5: Delete the DunGEN source/content/schema/assets from Stormlight**

```bash
git rm -r DunGEN
git rm supabase/migrations/003_procgen_campaign_mode.sql
git rm supabase/migrations/004_shared_dungen_assets.sql
git rm docs/superpowers/specs/2026-03-21-dungen-content-first-design.md
git rm docs/superpowers/specs/2026-03-23-dungen-campaign-book-content-design.md
git rm docs/superpowers/specs/2026-03-24-dungen-biome-map-generator-design.md
git rm docs/superpowers/plans/2026-03-21-procedural-dungeon-campaign-mode.md
git rm docs/superpowers/plans/2026-03-23-dungen-campaign-book-content.md
git rm docs/superpowers/plans/2026-03-24-dungen-biome-map-generator.md
git rm docs/superpowers/plans/2026-03-27-baked-walls-and-set-dressing.md
git rm docs/superpowers/plans/2026-03-28-procedural-pixel-texture-pipeline.md
git rm public/assets/DarkGrit-a.png public/assets/DarkGrit-b.png public/assets/DarkGrit-c.png public/assets/DarkGrit-d.png
```

- [ ] **Step 6: Run a schema grep to confirm DunGEN tables are no longer declared**

Run:

```bash
rg -n "procgen_campaigns|procgen_sections|procgen_room_states|procgen_overrides|procgen_section_previews|shared_assets" supabase/migrations
```

Expected: only `013_remove_dungen_schema.sql` should mention those tables

- [ ] **Step 7: Commit the documentation and schema cleanup**

```bash
git add README.md SETUP.md supabase/migrations/013_remove_dungen_schema.sql
git commit -m "chore: remove dungen schema from stormlight"
```

## Task 8: Run the final VTT-only verification sweep

**Files:**
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/package-lock.json` if dependency cleanup becomes necessary
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlayRoute.test.tsx`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlaySession.test.tsx`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/__tests__/useSession.test.tsx`
- Test: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/__tests__/useRealtime.test.ts`

- [ ] **Step 1: Confirm there are no live source imports left**

Run:

```bash
rg -n "procgen|dungen|DunGEN|generatedRenderPayload|generatedSectionId|launching=1" src README.md SETUP.md
```

Expected: no hits in live Stormlight files except the historical separation spec and this implementation plan

- [ ] **Step 2: Run the targeted regression suite**

Run:

```bash
npm run test:run -- src/components/play/PlayRoute.test.tsx src/components/play/PlaySession.test.tsx src/hooks/__tests__/useSession.test.tsx src/hooks/__tests__/useRealtime.test.ts
```

Expected: PASS

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: PASS with no unresolved imports from removed procgen code

- [ ] **Step 4: Inspect git status for only intentional changes**

Run:

```bash
git status --short
```

Expected: only the planned route, hook, map, docs, asset, and deletion changes remain

- [ ] **Step 5: Create the final cleanup commit**

```bash
git add src App.tsx README.md SETUP.md public supabase docs
git commit -m "refactor: split endless dungeon out of stormlight vtt"
```

- [ ] **Step 6: Optional dependency cleanup**

If build warnings show dead packages that existed only for DunGEN, remove them in a follow-up commit rather than mixing package cleanup into the separation diff.

## Verification Checklist

- [ ] `/campaign` and `/DunGEN` routes are gone from Stormlight
- [ ] Home and play entry surfaces present only VTT actions
- [ ] `useRealtime` no longer has a campaign mode
- [ ] `useSession` no longer loads or synthesizes generated maps
- [ ] `useMap` no longer persists active generated sections
- [ ] `MapCanvas` renders only uploaded-map flows
- [ ] `src/types/index.ts` contains no procgen domain types
- [ ] `src/procgen/` is gone from Stormlight
- [ ] `DunGEN/` is gone from Stormlight
- [ ] procgen migrations are gone from Stormlight
- [ ] an explicit cleanup migration drops DunGEN Supabase tables from existing Stormlight databases
- [ ] README and setup docs describe only the VTT product
- [ ] the extracted Endless Dungeon repo contains the copied source and content

## Execution Notes

- Keep commits small and thematic. Do not mix route cleanup, hook cleanup, map rendering cleanup, and docs cleanup into one commit until the final squash decision is explicit.
- If an ambiguous file still makes sense in a VTT-only world, keep it and remove only the DunGEN-specific branch.
- If the new Endless Dungeon repo needs one more support file to preserve the extracted code safely, copy that file before deleting anything from Stormlight.
