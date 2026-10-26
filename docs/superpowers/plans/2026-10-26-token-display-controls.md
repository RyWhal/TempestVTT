# Token Display Controls Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; steps use checkbox syntax.

**Goal:** Put names behind token circles, restrict hit targets to circles, and expose shared token transparency.

**Architecture:** TokenLayer owns ordered label/body Konva layers and transient drag positions. TokenNameLabel owns non-interactive label rendering; Token retains the body and drag rollback with one circular hit target. Session converters/settings persist tokenOpacity; a small GM control saves on gesture completion. Existing realtime delivers session updates.

**Tech Stack:** React, TypeScript, React Konva, Zustand, Supabase Postgres, Vitest, Playwright.

### Data and settings
- [x] Add failing converter and useSession settings tests for default/zero opacity, persistence, invalid values, GM-only writes and save errors.
- [x] Add `src/lib/tokenAppearance.ts` normalization, session/db types, settings update mapping, and `supabase/migrations/019_token_opacity.sql` with a default and range constraint. Keep shared DB untouched.
- [x] Test and implement `src/components/gm/TokenTransparencyControl.tsx`, then integrate into GMSettings. Save on release/key release/blur, deduplicate while saving, restore on failure, reflect shared updates.

### Rendering and interaction
- [x] Reproduce hit/layer failures using the actual Token component in an isolated temporary Vite browser fixture before production edits.
- [x] Extract non-interactive `TokenNameLabel.tsx`; add `TokenLayer.tsx` for labels below bodies and transient drag tracking. Update Token.tsx for decorative-only visuals and one circular hit target, and expose drag-move notifications.
- [x] Update MapCanvas to pass NPC then PC entries into TokenLayer; apply session opacity, permission/mode and hidden filtering, reset on map switch. Verify circle center/edge/corners, labels over other bodies, creation-order independence, zero-opacity click-through, drag tracking and rollback.

### Verification and delivery
- [x] Test GM setting changes flowing to two mocked client views through session updates and reload persistence, including endpoints. Do not claim live backend verification.
- [x] Remove temporary fixtures, run full tests/build/diff check, obtain independent code review, and commit the feature branch. Report migration requirement and unperformed database/live multiplayer tests. Do not merge or deploy without a user request.

## Final verification

- Full suite: 39 files / 209 tests passed. Production build and whitespace checks passed.
- Actual-canvas regression reproduced creation-order picking as 5 versus Amaram before the fix. Both orders pick 5 afterward; portrait pixel checks show names below the body. Label-only regions, image corners, and decorative rings are not pickable. Hidden NPC names are absent for players.
- Drag checks cover label following, rollback, an older pending save completing after a newer drag, and map-key reset while a save is pending. PC visibility filtering and shared zero opacity have unit coverage.
- Two isolated Chromium contexts used the local production build at http://127.0.0.1:5184/play with mocked Supabase REST and WebSocket transport. Explicit subscription readiness, actual layer opacity, and raster assertions verified 50%, 100%, and 0% transparency on the player client and reload persistence. At 100% transparency no token-colored pixels remain; names/bodies share opacity zero. Exactly one PATCH per completed slider change.
- Desktop 1280x900 and mobile 390x844 settings layouts inspected. Browser plugin not available; bundled Playwright used. No browser errors in the final production-build checks.
- An earlier development-mode mock run was rejected: no realtime subscribers had joined and an asynchronous truthiness wait falsely passed. The final check polls resolved values and actual canvas layers, with subscription readiness required; it runs against the production build.
- Independent design/plan and code review found no actionable source issues.
- Migration 019 is included and statically reviewed. No local PostgreSQL runtime was available to execute it; neither the migration nor any live database/multiplayer test was run. Deployment requires applying 019 to the shared database first. No deployment or merge performed.
