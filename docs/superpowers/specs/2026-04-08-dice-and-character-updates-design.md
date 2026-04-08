# Dice, Plot Die, and PC Rename Updates Design

## Summary

This design covers five related gameplay updates:

1. Prevent modifier-only dice rolls.
2. Add a GM control to clear shared dice roll history.
3. Allow GM and players to rename player characters with permissions tied to who currently controls the character.
4. Update plot die behavior so it is a single optional die that rides alongside rolls containing a `d20`.
5. Add advantage and disadvantage to dice rolls by rolling the full selected recipe twice and keeping the higher or lower total.

These updates should preserve the current play flow while making the roll system more explicit and less error-prone.

## Goals

- Reject invalid roll combinations before they are persisted.
- Make plot-die outcomes match the intended Stormlight-style narrative behavior.
- Show enough roll detail in history for advantage, disadvantage, and plot-die outcomes to be understandable at a glance.
- Let the GM clear accumulated dice history without affecting chat or initiative.
- Let GMs always rename PCs and let players rename only the PC they currently control when the session setting allows it.
- Ensure current live displays use updated PC names, especially initiative entries.

## Non-Goals

- Reworking the initiative roll system beyond rename propagation.
- Rewriting historical dice roll records when a PC is renamed.
- Introducing persistent authentication or immutable player-to-character ownership.
- Adding support for multiple plot dice in a single roll.

## Existing Constraints

- Player identity and character identity are separate. A player may join as one username and control a differently named character.
- Character control is already mutable through the current claim and release flow, and rename permissions should move with that control.
- `dice_rolls` already stores a JSON `roll_results` payload and a denormalized `character_name` snapshot.
- Initiative entries store a denormalized `source_name`, so live rename propagation must explicitly update that data.

## Roll Rules

### Standard Dice Requirement

- A roll must contain at least one standard die from the existing dice selector.
- Modifiers alone are not a valid roll.
- The dice panel should disable the roll action when no standard dice are selected.
- The roll hook should also enforce this rule so invalid combinations cannot be inserted through UI mistakes or future callers.

### Plot Die Rule Set

- Plot die becomes a single on/off option, not a quantity selector.
- Plot die may only be enabled when the selected dice include at least one `d20`.
- Plot die is rolled alongside the normal selected dice and is not intended to be rolled by itself.
- Plot die has six fixed faces:
  - `opportunity`
  - `opportunity`
  - `blank`
  - `blank`
  - `complication_bonus_2`
  - `complication_bonus_4`
- Opportunity applies a positive narrative side effect and does not change the numeric total.
- Blank has no additional effect.
- Complication applies a negative narrative side effect and adds either `+2` or `+4` to the numeric total based on the face that lands.
- The complication bonus is part of the final kept total and must be shown explicitly in roll history.

### Advantage And Disadvantage

- Add a roll mode selector with three states:
  - `normal`
  - `advantage`
  - `disadvantage`
- Advantage and disadvantage duplicate the entire selected roll recipe, not just `d20` results.
- Each attempt includes:
  - the same selected dice pool
  - the same modifier
  - the same plot-die toggle state
- The system rolls two independent attempts and then keeps:
  - the higher total for advantage
  - the lower total for disadvantage
- The roll history must display both attempts and clearly mark which attempt was kept.

## Roll Result Data Shape

Keep `dice_rolls` as the persisted source of truth, but enrich `roll_results` so the UI can render the full story of the roll without guessing.

The saved `roll_results` payload should include:

- `mode`: `normal | advantage | disadvantage`
- `expression`: the base dice expression built from the selected standard dice and modifier
- `attempts`: one or two attempt snapshots
- `keptAttemptIndex`: which attempt supplied the displayed result
- `total`: the displayed kept total

Each attempt snapshot should include:

- the standard rolled dice breakdown
- the numeric modifier
- the subtotal before plot die
- plot-die outcome metadata when enabled
- final attempt total after any plot-die complication bonus

Plot-die metadata should be explicit enough for rendering without inference, for example:

- `enabled`
- `face`
- `bonus`
- `label`

The existing top-level `plot_dice_results` column can be kept for compatibility during the transition if helpful, but the canonical rendering path should come from the richer `roll_results` structure so all modes can be displayed consistently.

## Dice Panel Behavior

### Inputs

- Keep the current standard dice picker and modifier controls.
- Replace plot-die count controls with a single checkbox or toggle.
- Add a simple roll mode selector for normal, advantage, and disadvantage.
- Keep the existing visibility selector.

### Validation

- Disable the roll button when no standard dice are selected.
- If the plot die is enabled and the selected dice do not include a `d20`, block the roll and explain why.
- Clear should reset:
  - selected dice
  - modifier
  - plot-die toggle
  - roll mode

### Roll History Display

Each history entry should show:

- player username
- stored character-name snapshot
- roll mode
- the rolled expression
- each attempt's full dice results
- any modifier applied
- plot-die face and complication bonus when present
- which attempt was kept for advantage or disadvantage
- the final displayed total

The history layout should make it obvious that advantage and disadvantage generated two attempts and that only one total is final.

## Clearing Dice Roll History

- Add a GM-only clear action to the dice history UI.
- The action should prompt for confirmation.
- Clearing should delete `dice_rolls` rows for the current session only.
- Clearing should update local state immediately so the panel empties even if realtime delivery lags.
- This action should not clear chat messages or initiative data.

## PC Rename Permissions

### Session Setting

- Add a new session setting: `allowPlayersRenamePcs`.
- Surface it in GM settings near the existing NPC rename toggle.

### Permission Rules

- GMs may always rename PCs.
- Players may rename only the character they currently control.
- Player rename permission is active only when `allowPlayersRenamePcs` is enabled.
- If a character is released and claimed by another player, rename permission moves with the new controller.
- Players may not rename other PCs in the session.

## PC Rename Entry Points

The experience should mirror current NPC rename behavior as closely as possible instead of introducing a new dedicated rename workflow.

Primary entry points:

- GM character manager for all PCs.
- Player-facing surfaces for the currently controlled character.
- Initiative entries for player-character rows when the current user is allowed to rename that PC.

Implementation can choose the exact player-facing entry control that best matches the current UI patterns, but the permission rule must stay tied to the controlled character.

## Rename Propagation

When a PC is renamed:

- Update the `characters` row.
- Update local character state immediately.
- Update any current initiative entries whose `source_type` is `player` and whose `source_id` matches that character.
- Realtime updates should continue to hydrate other connected clients through the existing character subscription flow.

Historical data treatment:

- Existing dice roll records keep their stored `character_name` snapshot.
- Existing chat messages are untouched.
- Current live initiative/order displays should reflect the new PC name after propagation.

This preserves history while keeping live table state accurate.

## Testing Strategy

Add or update tests to cover:

- modifier-only rolls are rejected
- plot die cannot be used without a selected `d20`
- plot die with a `d20` stores the correct face and complication bonus
- advantage rolls duplicate the full recipe and keep the higher total
- disadvantage rolls duplicate the full recipe and keep the lower total
- roll history rendering shows both attempts and the kept result
- GM can clear dice roll history for the current session
- players cannot rename PCs they do not currently control
- controlling players can rename their PC when the setting is enabled
- controlling players cannot rename their PC when the setting is disabled
- GM can rename any PC
- PC rename updates current initiative entries for that character

## Risks And Mitigations

### Risk: UI and persisted roll payload drift apart

Mitigation:

- Centralize roll construction in the dice utility layer and have the UI render from the saved payload shape.

### Risk: plot-die rules become split across UI and storage logic

Mitigation:

- Enforce plot-die eligibility and bonus application in the roll hook or dice helper, not only in component state.

### Risk: rename propagation misses denormalized live data

Mitigation:

- Update initiative entries explicitly as part of character rename handling and add regression tests around it.

### Risk: richer roll payload breaks older history rendering assumptions

Mitigation:

- Update types and rendering in the same change and keep compatibility logic narrow and temporary if needed.

## Recommended Implementation Direction

Use the structured-roll-metadata approach:

- keep the existing `dice_rolls` table and overall persistence flow
- extend `roll_results` to represent attempts, kept result, and plot-die outcome details
- update the dice panel and history rendering to consume that richer data
- add a GM clear-history path
- add `allowPlayersRenamePcs` as a session setting and wire rename propagation through the existing character update path

This approach keeps the change set focused while leaving the roll system easier to extend and reason about later.
