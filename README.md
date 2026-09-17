# TempestVTT

TempestVTT is a TypeScript-based virtual tabletop (VTT) for tabletop RPG sessions. Built lovingly with assistance from OpenAI's Codex and Claude Code. 


## Documentation

- [Full product, setup, and deployment guide](./SETUP.md)

## Tech stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS.
- **State management:** Zustand stores for session, map, chat, and admin state.
- **Realtime + persistence:** Supabase Postgres + Supabase Realtime + Supabase Storage.
- **Rendering:** `react-konva`/`konva` for map canvas and token interactions.

## High-level architecture

### Frontend routing

The SPA routes are defined in `src/App.tsx`:

- `/` home
- `/create` create session
- `/join` join session
- `/lobby` session lobby (protected)
- `/play` active play view (protected)
- `/admin`, `/admin/dashboard`, `/admin/assets/new` for admin workflows

A protected route wrapper redirects to home if there is no active session or user context.

### Core state and domain flow

`useSession` (`src/hooks/useSession.ts`) orchestrates the primary lifecycle:

1. Create/join a session.
2. Load all session-scoped entities (maps, characters, NPCs, players, chat, dice).
3. Handle GM claim/release and leave-session cleanup.

Realtime synchronization happens via `useRealtime` (`src/hooks/useRealtime.ts`), which subscribes to Supabase Postgres changes for session-scoped tables and updates Zustand stores.

The main stores are:

- `sessionStore`: session identity, current user, players, connection status.
- `mapStore`: maps, active map, fog/grid controls, character/NPC placement state.
- `chatStore`: chat log and dice roll log state.
- `adminStore`: admin auth/session UI data.

### Backend schema (Supabase)

The initial migration (`supabase/migrations/001_initial_schema.sql`) defines key entities:

- `sessions`
- `maps`
- `characters`
- `session_players`
- `npc_templates`
- `npc_instances`
- `dice_rolls`
- `chat_messages`

It also enables RLS policies (currently open/trust-based), adds performance indexes, and enables realtime publication for all key tables.

Storage setup is handled in `002_storage_setup.sql`, and admin/global asset schema lives in `003_admin_and_assets.sql`.

## Frontend feature areas

- `src/components/session/*`: entry flow (home/create/join/lobby).
- `src/components/play/PlaySession.tsx`: primary in-session shell and tabbed side panels.
- `src/components/map/*`: map canvas, grid, fog, and token rendering.
- `src/components/gm/*`: GM tools (maps, characters, NPCs, fog controls, exports, global assets).
- `src/components/chat/*`: chat UI.
- `src/components/dice/*`: dice roller, roll log, and lazy-loaded 3D map roll overlay.
- `src/components/inventory/*`: character inventory interactions.
- `src/components/admin/*`: admin login/dashboard/asset creation.

## 3D dice on the map

New rolls tumble over the map and settle on the saved results; the animation never rerolls the outcome. Standard d4, d6, d8, d10, d12, and d20 shapes are supported, plus d100 as a tens/units pair (`00 + 0 = 100`) and the Tempest plot die. D4 labels are read at the upper vertex. Advantage/disadvantage shows both attempts and identifies the kept result.

- Mixed rolls show at most **20 physical dice per batch**. New requests allow **100 physical dice total**, counting percentile pairs, both attempts, and plot dice. The selector retains its existing 20-per-type cap.
- Public, GM-only, and self-only rolls follow the existing viewer rules. Hydrated history and duplicate realtime deliveries do not replay animations.
- Final dice/results remain visible for 12 seconds, or fade sooner when the player clicks elsewhere. Intermediate batches advance promptly; dismissing skips the rest of that roll. Map controls remain clickable. Small-screen dice appear above the drawer while leaving the left toolbar clear.
- **Show 3D dice** in the dice panel is a saved preference for this browser/device; turning it off hides map dice/results without affecting rolls, history, sound settings, or other players. Re-enabling applies to future rolls.
- Reduced motion, failed WebGL, and unsupported legacy dice use readable results. Oversized historical rolls show their total and refer to the full history.
- Three.js loads on demand. Rendering stops after settling, and GPU resources are released afterward. Bursts retain the active roll plus seven pending animations; skipped pending animations remain in history.

No database migration is required. Tests: `npm test -- --run`; production build: `npm run build`.

## Environment setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure Supabase credentials in `.env.local`:

   ```bash
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

3. Run development server:

   ```bash
   npm run dev
   ```

## Notes for adding new features

- Prefer adding data access and mutation logic in hooks (`src/hooks`) rather than components.
- Keep derived app state in Zustand stores and keep component-local state UI-specific.
- For new persistent entities, update both:
  - Supabase migration(s), and
  - Type adapters in `src/types/index.ts`.
- For collaborative/visible state, wire corresponding realtime listeners in `useRealtime`.
- For uploadable assets, use helpers in `src/lib/supabase.ts` and existing storage bucket patterns.
