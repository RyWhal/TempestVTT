# Token Label Width Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to execute inline. Steps use checkbox syntax for tracking.

**Goal:** Display short names in full on small tokens.

**Architecture:** One derived label width in `src/components/map/Token.tsx`, shared by the label's width and horizontal position. Existing Konva clipping provides ellipsis for longer text.

**Tech Stack:** React, TypeScript, Konva, Vite, Vitest, Playwright.

- [x] Run existing Token tests as baseline.
- [x] Create a temporary browser fixture that renders the actual Token component and inspect Konva's rendered text. Reproduce Tama truncation with a 10px grid and tiny token before the fix.
- [x] Define `const labelWidth = Math.max(80, pixelSize, gridCellSize * 1.8)` beside the token radius. Apply it to label width and use `(pixelSize - labelWidth) / 2` for x.
- [x] Re-run the same browser regression; inspect Tama's complete rendered text, centered labels, long-name ellipsis, and unchanged token diameters at multiple zoom levels and overrides. Save before/after screenshots outside the repository. Browser plugin not available; use bundled Playwright and Chromium.
- [x] Remove temporary fixtures. Run `npm run test:run`, `npm run build`, and `git diff --check`. Commit the reviewed fix on the feature branch and report the result. Do not merge or deploy without a user request.

## Verification

- Before the fix, the actual Token canvas rendered Tama as T… in an 18px label box at each zoom level.
- After the fix, real Konva text renders Tama, Kaladin, and Mr'tadna completely. Checks passed at 50%, 100%, and 193% zoom with size overrides on/off and 10px/50px grids.
- Centering, long-name ellipsis, and circle diameters (5px, 16px, 8px, 200px) were verified; no browser errors or framework overlay.
- Local Chromium fixture at http://127.0.0.1:5181/.token-label-qa.html; temporary fixture removed after checks. Browser plugin not available; bundled Playwright used. This was a component canvas test, not a live session or mobile/Safari test.
- All 185 tests across 37 files and the production build passed. Whitespace check passed. Independent document/code review approved the scoped fix.
