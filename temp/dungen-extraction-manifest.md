# DunGEN Extraction Manifest

This manifest combines the live-reference sweep across `src`, `supabase`, `public`, `README.md`, and `SETUP.md` with the approved DunGEN design and plan docs that also need to leave Stormlight. Tree-level entries cover the files underneath them, so the `src/procgen/` and `src/components/dungen/` copy buckets account for the many DunGEN hits found during verification.

Copy-bucket entries are expected to move out of Stormlight as part of extraction unless a later task explicitly decides a file should stay. Delete-bucket entries are the files that should be removed from Stormlight after the copy is safely preserved elsewhere.

## Copy To Endless Dungeon Repo
- DunGEN/
- src/components/dungen/
- src/procgen/
- src/stores/procgenStore.ts
- src/hooks/useProcgenCampaign.ts
- src/hooks/useProcgenContent.ts
- supabase/migrations/003_procgen_campaign_mode.sql
- supabase/migrations/004_shared_dungen_assets.sql
- docs/superpowers/specs/2026-03-21-dungen-content-first-design.md
- docs/superpowers/specs/2026-03-23-dungen-campaign-book-content-design.md
- docs/superpowers/specs/2026-03-24-dungen-biome-map-generator-design.md
- docs/superpowers/plans/2026-03-21-procedural-dungeon-campaign-mode.md
- docs/superpowers/plans/2026-03-23-dungen-campaign-book-content.md
- docs/superpowers/plans/2026-03-24-dungen-biome-map-generator.md
- docs/superpowers/plans/2026-03-27-baked-walls-and-set-dressing.md
- docs/superpowers/plans/2026-03-28-procedural-pixel-texture-pipeline.md
- src/components/map/generatedFloorRender.ts
- src/components/map/generatedFloorRender.test.ts
- src/components/map/generatedWallRender.ts
- src/components/map/generatedWallRender.test.ts
- public/assets/DarkGrit-a.png
- public/assets/DarkGrit-b.png
- public/assets/DarkGrit-c.png
- public/assets/DarkGrit-d.png

## Delete From Stormlight After Copy
- src/components/play/PlayLaunchGate.tsx
- src/components/map/generatedFloorRender.ts
- src/components/map/generatedFloorRender.test.ts
- src/components/map/generatedWallRender.ts
- src/components/map/generatedWallRender.test.ts
- public/assets/DarkGrit-a.png
- public/assets/DarkGrit-b.png
- public/assets/DarkGrit-c.png
- public/assets/DarkGrit-d.png

## Audit Before Editing
- These files are expected to stay in Stormlight, but they contain DunGEN-aware branches or tests that must be simplified before the split is complete.
- src/App.tsx
- src/components/map/MapCanvas.tsx
- src/hooks/useMap.ts
- src/hooks/useRealtime.ts
- src/hooks/useSession.ts
- src/hooks/__tests__/useSession.test.tsx
- src/components/play/PlayRoute.test.tsx
- src/components/play/PlaySession.test.tsx
- src/types/index.ts
