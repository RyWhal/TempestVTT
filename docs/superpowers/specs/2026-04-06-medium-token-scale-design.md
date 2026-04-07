# Medium Token Scale Design

## Goal

Add a GM-only per-map setting that defines how large a Medium token should render relative to the map's grid, then derive every other token size from that baseline.

This is meant to solve maps where the current `1 grid cell = 1 Medium token` assumption makes tokens look too large or too small even when the map is otherwise usable.

## Decision Summary

Recommended approach: store a per-map `mediumTokenScale` value and make token rendering derive from:

`gridCellSize * mediumTokenScale * TOKEN_SIZE_MULTIPLIERS[size]`

This keeps token records category-based (`tiny`, `small`, `medium`, `large`, `huge`, `gargantuan`) instead of introducing per-token visual scaling.

Changing the map's Medium baseline should:

- immediately update tokens already on that map
- preserve each token's size category
- affect both player characters and NPC instances on that map
- affect only that one map

## Why This Approach

### Option selected

The selected design adds one new map-level setting and leaves character and NPC records unchanged.

That fits the current code well because token size is already rendered dynamically from map state plus token category. Replacing the hardcoded Medium baseline with a stored per-map value gives the GM the control they want without rewriting token data.

### Why not store a pixel size instead

Storing a raw Medium pixel size would work, but the GM is thinking in relation to the grid, not in raw pixels. A scale value expresses the user's intent more clearly and composes naturally with the existing `gridCellSize` setting.

### Why not add per-token custom visual scales

Per-token scale overrides would blur the boundary between a token's rules-facing size category and its visual footprint. That adds complexity without helping the stated use case, which is calibrating a map-wide Medium baseline.

## Current Behavior

Today token size is determined exclusively by:

`gridCellSize * TOKEN_SIZE_MULTIPLIERS[size]`

That means:

- Medium is always exactly one grid cell
- Small is also exactly one grid cell
- Large is always two grid cells
- changing map `gridCellSize` changes all token sizes
- changing token size category updates the multiplier, but there is no map-level size baseline

## Product Requirements

### Map scope

The Medium baseline is a map setting, not a session setting.

Different maps in the same session may use different Medium baselines.

### GM ownership

Only the GM can edit the Medium baseline because it lives in map settings.

All connected clients should observe the updated token sizing after the map record changes.

### Derived sizing

The Medium baseline defines the rendered size for a Medium token on that map.

All other token sizes remain derived from the existing category multipliers:

- Tiny = `0.5x` Medium
- Small = `1x` Medium
- Medium = `1x` Medium
- Large = `2x` Medium
- Huge = `3x` Medium
- Gargantuan = `4x` Medium

### Existing tokens

When the GM saves a new Medium baseline for a map, tokens already on that map should resize immediately using the new baseline.

Their size category values must not change.

### Position stability

Changing the Medium baseline must not rewrite token positions in storage.

Tokens should re-render using their existing top-left coordinates, which matches the current positioning model.

### Grid relationship

Token size continues to depend on the map's `gridCellSize` even if the grid overlay is hidden.

The new Medium baseline is an additional multiplier layered on top of that existing grid-cell measurement.

## Non-Goals

This work does not include:

- per-token custom scale overrides
- session-wide default Medium sizing
- drag handles or direct on-canvas token calibration
- changes to token collision or movement rules
- changing the meaning of the existing token size categories

## Data Model

Add a new numeric field to `maps`:

- database column: `medium_token_scale`
- type: floating-point numeric
- default: `1`
- constraint: positive value only

TypeScript map types and converters should expose this as:

- `Map.mediumTokenScale: number`
- `DbMap.medium_token_scale: number`

Existing maps should hydrate to `1` automatically through the database default or a converter fallback.

## Rendering Model

Token rendering should use a single shared calculation for footprint size:

`tokenPixelSize = gridCellSize * mediumTokenScale * TOKEN_SIZE_MULTIPLIERS[size]`

This calculation should become the source of truth for:

- player character token rendering
- NPC token rendering
- any new map-settings preview for token sizes

Using one shared calculation avoids the canvas and settings preview drifting apart.

## GM Workflow

### Location

The control belongs in the existing GM map settings panel, grouped with grid-related settings because it defines token size relative to the map's grid.

### Controls

Add a `Default Medium token size` control made of:

- a slider
- a numeric input
- helper copy explaining that `1.0` means a Medium creature occupies one full grid cell

The control should edit local settings state until the GM presses `Save`, matching the current map-settings workflow.

### Range

Use a clamped positive range suitable for typical calibration work:

- minimum: `0.25`
- maximum: `3`
- slider step: `0.05`
- numeric input: same min and max, freeform decimal entry allowed within that range

### Preview

Add a lightweight preview inside map settings that shows how derived token sizes will look against a single grid cell.

The preview should:

- update immediately as the local setting changes
- show Tiny, Small, Medium, Large, Huge, and Gargantuan for quick comparison

The preview exists only inside the settings panel. The live board should update after the GM saves.

## Persistence And Realtime

Saving map settings must persist `mediumTokenScale` on the `maps` row through the existing `updateMapSettings` flow.

Because maps are already hydrated and synchronized through the existing map update path, connected clients should receive the updated map value and re-render tokens from the new baseline without any token-row migrations.

## Export And Import Compatibility

Session export and import should preserve the map's Medium baseline.

If exported map settings already include grid-related fields, this new field should be included in the same map-settings payload so a round-trip does not silently reset token sizing back to `1`.

## Implementation Outline

### Schema and types

- add `medium_token_scale` to the `maps` table migration with default `1`
- extend `DbMap`, `Map`, and `dbMapToMap`
- extend any export/import types that serialize map settings

### Map settings flow

- allow `useMap.updateMapSettings` to send and store `mediumTokenScale`
- extend `MapManager` settings state and form controls
- add a compact token-size preview component or inline preview markup

### Token sizing

- replace the hardcoded Medium baseline in token rendering with the new formula
- centralize size calculation in a helper shared by token rendering and the map-settings preview

## Testing Requirements

Implementation should include coverage for the behavior that matters most during planning:

- map type conversion includes `mediumTokenScale`
- `updateMapSettings` persists the new field
- token pixel size calculation uses `gridCellSize * mediumTokenScale * multiplier`
- changing the map baseline changes rendered size for existing tokens without changing their size category
- exported and imported map settings preserve `mediumTokenScale`

## Risks And Guardrails

### Risk: ambiguous meaning when grid overlay is hidden

Guardrail: keep helper copy explicit that this setting is still based on the map's configured grid cell size, even if the grid is not visible.

### Risk: preview and live token math diverge

Guardrail: use one shared helper for token size calculation.

### Risk: invalid values collapse token rendering

Guardrail: clamp UI input and enforce a positive stored value.

## Planning Readiness

This design stays within one subsystem slice:

- one new map field
- one rendering formula change
- one GM settings UI extension
- associated tests and export/import compatibility

It is ready for a focused implementation plan without introducing parallel feature tracks or broader token-system refactors.
