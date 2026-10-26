# Standalone plot die

User approved this design and implementation on October 26, 2026.

Replace the plot checkbox with a Plot die selector beside the standard dice. It selects at most one plot die, supports deselection and Clear, and is visible only when the session enables plot dice. A plot die may roll alone or with standard dice; remove the d20 requirement.

A standalone plot roll always uses normal mode and no modifier, even if a previous standard selection used either. Disable those controls while only the plot die is selected. Store a readable `Plot die` expression and use existing structured plot results, attempts, visibility, broadcasts, and local animation. Combined expressions remain compatible with existing storage. Show the face and complication bonus prominently for standalone rolls instead of an empty numeric-dice breakdown.

No schema changes or rewriting earlier rolls. Keep combined bonus arithmetic and advantage/disadvantage behavior. A reroll is a new independent history entry; it does not edit a previous skill check. Existing visibility and remote-history/local-animation behavior are preserved.

Validate all faces, single-attempt semantics, mixed and normal rolls, empty selections, GM feature gating, deselection, persistence/broadcast payloads, and plot-only animation presentation. Run the complete tests, build, diff check, and a browser interaction with mocked session/database responses.
