# Map dice animation implementation plan

> Execute the approved design in this session; independent reviewers verify the spec/plan and final code.

**Goal:** Show result-matched 3D polyhedral rolls over the map without blocking play.

**Architecture:** A bounded queue in the chat store distinguishes new roll events from history hydration. A pure presentation adapter expands percentile/plot dice and roll attempts into batches. A lazy-loaded Three.js renderer handles geometry and controlled settling; React owns timing, accessible feedback, visibility, and fallback.

**Tech stack:** React 18, Zustand, TypeScript, Three.js, Vitest, existing browser QA tools.

### 1. Roll limits and event delivery
- [x] Add failing tests in `src/lib/dice.test.ts` for aggregate physical count including attempts and d100. Reject oversized groups rather than silently dropping them.
- [x] Add `src/lib/diceLimits.ts` and apply validation in `src/lib/dice.ts`; preserve existing supported notation/results.
- [x] Add `src/stores/chatStore.test.ts` for hydration, deduplication (including after completion/reload), bounded queue, acknowledgement, and cleanup.
- [x] Implement queue and bounded seen IDs in `src/stores/chatStore.ts`; no hook/network changes required.
- [x] Run focused Vitest files and confirm pass.

### 2. Presentation and geometry
- [x] Add adapter tests in `src/components/dice/dicePresentation.test.ts`: all die types, percentile 1/10/100, batches <=20 with pairs together, plot die, legacy rows, kept attempts, oversized historical fallback, privacy.
- [x] Implement `dicePresentation.ts` with typed descriptors/batches and visibility predicate; constrain untrusted/legacy payload processing.
- [x] Add geometry tests in `diceGeometry.test.ts`: exact face/vertex counts, planar kite faces, outward normals, fixed labels, every result orientation (including vertex-up d4), opposite numbering, no invalid result rotation.
- [x] Implement `diceGeometry.ts` using Three.js standard regular solids and a custom pentagonal trapezohedron, face label bases, fixed numbering, and result quaternions.
- [x] Run focused tests.

### 3. Renderer and overlay
- [x] Implement `diceRenderer.ts` for transparent lit 3D dice, face labels, ground shadows, seeded tumbling paths, correct final orientations, responsive spacing, and disposal. Three.js remains in dynamic chunk.
- [x] Add `DiceRollOverlay.test.tsx` for hidden/history rolls, queue progress, private viewer changes, static reduced-motion results, import/renderer failure, and batch completion.
- [x] Implement `DiceRollOverlay.tsx` and styles with lazy renderer, timers, noninteractive map layer, readable totals and attempt markers, static fallback, and responsive drawer inset.
- [x] Mount in `src/components/play/PlaySession.tsx`; extend `DicePanel.tsx` with percentile die and limit help.
- [x] Run overlay tests and existing PlaySession/DicePanel regressions.

### 4. Review and verification
- [x] Run `npm test -- --run`, `npm run build`, and `git diff --check`.
- [x] Run a local Vite server and browser QA using a local-only fixture, exercising actual overlay, store queue, mixed rolls, each face, percentile dice, plot dice, twenty dice, batches, narrow layout, reduced motion, and WebGL fallback. Save screenshots outside tracked source.
- [x] Request independent code review; address material findings and rerun affected tests.
- [x] Document verified behavior and limitations in README. Report local status, no deployment claim.


## Verification notes

- Spec/plan review approved; final independent code review found the d100 expression-builder omission, now fixed with builder and DicePanel regression tests. Follow-up review found no remaining material issues.
- Browser QA used the actual PlaySession, DicePanel, MapCanvas, roll store, and renderer with a local-only Supabase write double; no real session or database was modified.
- Desktop (1280x720): mixed shapes and face/result agreement, d100 selected through DicePanel, twenty simultaneous dice, a 21-die batch transition, advantage attempts and plot faces, and cleanup after rolls.
- Narrow viewport (390x844): twenty dice clear the toolbar; results fit. Reduced-motion and deliberately unavailable WebGL produce static values without a 3D canvas. Map zoom changed from 22% to 28% through the result overlay with the drawer closed.
- Geometry tests verify every face orientation and d4 vertex outcomes. Unit tests cover visibility/role changes, history hydration, duplicate delivery, bounded queues, context-loss recovery, and stalled-renderer timeout.
- Live multi-client Supabase transport and deployment were not performed. The existing network delivery paths are unchanged. Existing React Router/Konva/browser-data warnings remain.
- Final verification: all 134 tests across 32 files passed; production build passed; `git diff --check` passed. After removing a test-only unsupported Testing Library option caught by TypeScript, all eight DicePanel tests were rerun and passed, followed by a successful build.


## Approved follow-up: longer results and personal toggle

- Added a 12-second final-result hold, click-outside dismissal of the entire active roll, and persisted Show 3D dice checkbox in DicePanel. Intermediate batches continue promptly.
- Preference is local to the browser/device. Disabled visuals clear the pending queue while retaining dice history; re-enabling applies to future rolls.
- Added tests for persistence, timed hold, click-through dismissal, clicks inside the result card, intermediate-batch dismissal, and toggling without replaying history. Independent review found no material issues.
