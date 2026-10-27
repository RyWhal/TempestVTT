# Token layering, interaction, and shared transparency

User requested all token names behind all token circles, circle-only picking/dragging, and a transparency slider in settings. User selected a GM-controlled setting shared by everyone at the table.

Render a non-interactive label layer below every NPC and PC token body, above drawings/effects and below existing fog. Keep label sizing/centering unchanged. Labels must track local dragging and return to the authoritative position after success/failure; map switches remove temporary drag positions. Preserve hidden-NPC filtering and PC visibility settings.

Token visuals (portraits, initials, rings) do not participate in picking. A transparent circular hit shape inside each token group supplies the sole selection/drag target, without including image corners, rings, or names. Preserve existing movement permission/locking checks and NPC-before-PC body order.

Add session tokenOpacity (0 through 1, default 1), backed by sessions.token_opacity and migration 019. The GM settings slider displays transparency from 0% (opaque) to 100% (invisible), and saves on release/keyboard release/blur, deduplicating saves and disabling while a save is pending. All clients receive the committed value through existing session realtime updates. Failures restore the last committed value and show a toast. Missing/invalid legacy values default safely to opaque. Apply opacity to labels and bodies/rings, including the existing hidden-NPC dimming multiplier. At zero opacity disable token picking so invisible tokens do not intercept map input.

Include the migration, but do not apply it to the shared database or deploy until a deployment request. This display preference is not access control and does not change token visibility permissions.

Verification: actual Konva hit tests/pointer drags for overlapping names, image corners and rings; pixel-level layering checks in both creation orders and across PC/NPC groups; label tracking and failed-save rollback; shared slider saves at 0/50/100%, one pending write, errors, legacy defaults and realtime session updates; full tests/build. No claim of live multiplayer or database verification without running it.
