# Plot Die Selector Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement the approved work in this session. Steps use checkbox syntax for tracking.

**Goal:** Select and roll the plot die independently of a d20.

**Architecture:** Keep the existing single plot-result field and request option. Represent standalone requests with `Plot die`; normalize modifier and mode for plot-only requests in the roll engine. Render a matching selector and removable selection pill in DicePanel.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Vite, Playwright.

### Task 1: Roll engine

- [x] Update `src/lib/dice.test.ts` with standalone validation, all six face outcomes, no modifiers/extra attempts, and mixed non-d20 cases.
- [x] Run `npm run test:run -- src/lib/dice.test.ts` and confirm failures caused by current restrictions.
- [x] In `src/lib/dice.ts`, permit a selected plot die without standard dice; remove d20 validation. For requests with no standard dice, zero the parsed modifier and use normal mode. Preserve standard and mixed arithmetic and physical limits.
- [x] Rerun engine tests and confirm pass.

### Task 2: Selector and history

- [x] Update `src/components/dice/DicePanel.test.tsx` to cover standalone rolls, combined rolls, a single selectable plot die, removal/Clear, feature gating, inactive modifier/mode controls, and readable standalone history.
- [x] Run `npm run test:run -- src/components/dice/DicePanel.test.tsx` and verify expected failures.
- [x] In `src/components/dice/DicePanel.tsx`, replace checkbox with accessible selector and removable pill, count selected plot die, submit readable standalone expression, disable inapplicable controls, and hide empty numeric breakdown on standalone history. Preserve visibility and normal selections.
- [x] Rerun component tests.

### Task 3: Integration and verification

- [x] Add `src/hooks/__tests__/useChat.test.tsx` coverage for standalone persistence, local state and broadcast. Add `src/components/dice/dicePresentation.test.ts` coverage that standalone rolls produce exactly one correctly labeled plot die.
- [x] Run `npm run test:run`, `npm run build`, and `git diff --check`.
- [x] Browser flow: local play screen with mocked session -> select Plot die -> roll -> observe plot-only result, then d20 + Plot die. Capture desktop/mobile screenshots and console health. Browser plugin not available; use installed Playwright.
- [x] Review changes, commit on `codex/plot-die-selector`, and report evidence and any limits. Do not merge or deploy without a user request.

## Verification evidence

- Full suite: 37 test files, 185 tests passed. Production build and diff whitespace check passed.
- Chromium/Playwright at http://127.0.0.1:5179/play, 1280x844 and 390x844, using dummy Supabase configuration and mocked REST/WebSocket responses. Browser plugin not available.
- Verified plot-only selection, disabled modifier/mode controls, standalone face history and zero standard dice, combined d20/modifier/advantage payload, Clear, and fully visible controls after roll focus.
- Page identity, meaningful content, framework overlay absence, console errors, screenshots, interactions, and viewport overflow checks passed. Existing React Router future-flag warnings remain.
- Browser checks used animations disabled; automated presentation coverage verifies one labeled plot die and existing overlay tests passed. Live database and multi-client behavior were not exercised.
- Narrow action row now wraps into two rows to prevent the drawer from scrolling sideways and clipping controls.
- Independent design/plan and code reviews found no actionable issues.
