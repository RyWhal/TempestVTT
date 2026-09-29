# Map dice animation

Approved in conversation: render accurate polyhedral dice tumbling over the map and settling on the already-recorded result. Use controlled animation, not a second random roll or physics-driven result.

## Behavior

Support d4, d6, d8, d10, d12, d20, percentile d100 (two d10s), and the six-faced Tempest plot die. Multiple types and quantities share a roll. D4 uses vertex labels and settles on its opposite face. Other standard dice show the recorded face upward. Numbering is fixed for each mesh; orientation selects the result. Percentile 00 + 0 means 100. Unsupported legacy die types use readable result text, never an incorrect substituted shape.

Animate no more than 20 physical dice simultaneously; batch larger rolls. New requests permit at most 100 physical dice, counting percentile pairs, advantage/disadvantage attempts, and plot dice. Show both attempts sequentially and mark kept/discarded. Show the overall saved total (including modifiers and plot bonuses), then fade after 12 seconds on the final batch. Earlier batches advance promptly. Clicking outside the result card dismisses the entire active roll without consuming the click. A saved local Show 3D dice setting defaults on, suppresses all map roll overlays when off, and clears pending visuals without changing history or other players. Preserve all existing roll history and totals.

## Integration and lifecycle

New accepted chat-store roll insertions enqueue animation events. Bulk history loads never enqueue. Deduplicate local, broadcast, and database deliveries by roll ID using bounded session-scoped recent IDs, independently of history reloads. Keep an active roll and at most seven pending rolls during bursts; discarded pending animations remain in history. Clear queues on leaving or clearing history. The overlay additionally verifies session and viewer visibility at display time; changes to viewer permissions immediately hide private animations. Preserve existing public/GM-only/self semantics.

Mount overlay above the map but below interactive toolbars/drawers. Reserve desktop drawer space; keep controls clickable via pointer-events none. On narrow screens, float dice above the drawer with a left inset that leaves the toolbar clear; keep result feedback visible. Reduced-motion preference and renderer/import/context failures use static readable dice values and totals. Lazy-load Three.js only when a roll is animated; stop requestAnimationFrame after settling; dispose geometries, materials, textures, renderer, timers, and observers on cleanup.

## Scope and validation

No database migrations, changed random outcomes, asset service, or deployment. Add d100 to dice selection and display limits. Unit tests cover geometry topology, face/result orientation, percentile conversion, attempts, batching, caps, privacy, event deduplication, queue bounds, history hydration, and lifecycle. Build and all existing tests must pass. Browser checks cover actual rolling and settled dice, mixed shapes, twenty dice, batches, reduced motion, fallback, and narrow layout. Live multi-client transport is separately identified if only local store delivery is tested.
