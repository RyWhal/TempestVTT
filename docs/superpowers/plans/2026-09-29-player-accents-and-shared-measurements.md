# Player Accents and Shared Measurements Implementation Plan

**Goal:** Give each participant, including the GM, a unique selectable accent and share readable, short-lived line, radius, and cone measurements.

**Architecture:** Persist color leases in Supabase with serialized per-session allocation and a curated palette. Broadcast measurements as transient map-coordinate events; render owner labels and accents consistently across measurements, pings, and dice history.

**Tech stack:** React, TypeScript, Zustand, Konva, Supabase Postgres and Realtime.

## Approved behavior

- Selectable unique colors; occupied choices show their owner and cannot be selected.
- Reserve disconnected participants' colors for two hours. Refresh active reservations every minute; expiry is measured from the last server heartbeat, with approximately one minute of disconnect-detection uncertainty.
- One measurement per player; broadcast during dragging, hold ten seconds after release, then fade. Owner clicking elsewhere dismisses it for everyone. Other participants cannot dismiss it through the UI.
- Thin remote outlines, restrained fills, owner labels, a local hide-others preference, and GM private measurement mode.
- Matching accents on pings, dice history, result overlays, and participant list. Keep semantic success/danger styling.

## Tasks

- [ ] Color allocation: add migration, lease store, curated palette, reservation hook, picker, and PlaySession integration. Serialize selection on the server; preserve reservations when session membership rows are removed. Handle palette exhaustion explicitly.
- [ ] Measurements: extract shared shape renderer from MapCanvas, add transient message validation and lifecycle hook, throttle pointer updates, expire abandoned drags, reject stale packets, and clear on map/session changes. Add preferences and pointer cancellation handling.
- [ ] Identity accents: add owner information to ping messages and render name/color; add restrained color accents to dice cards and final result overlay.
- [ ] Verification: test allocation failure/expiry, malformed and out-of-order measurement packets, two participants, owner dismissal, timeout, private measurements, and existing dice behavior. Run the full test suite and production build.
- [ ] Release: apply the additive database migration only to the verified project, then verify allocation with independent clients. Clearly report local, database, and deployment status separately.

## Boundaries

The existing application uses anonymous session usernames rather than authenticated player identities. Membership checks and atomic allocation prevent ordinary UI races, but do not establish tamper-proof identity. Do not claim otherwise. Keep measurement traffic out of persistent map drawings, and never broadcast a GM-private measurement.
