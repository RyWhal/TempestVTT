# Tempest Table - Product + Setup + Deployment Guide

This guide is a full walkthrough for:

1. What the VTT can do (GM + player workflows)
2. What the Admin page can do
3. Local development setup
4. Supabase project creation + migration setup
5. Cloudflare Pages deployment from your own fork
6. Managing environment secrets/variables for dev and production

---

## 1) VTT feature guide (GM + players)

The app has two main user surfaces:

- **Session VTT** (`/`, `/create`, `/join`, `/lobby`, `/play`)
- **Admin console** (`/admin`, `/admin/dashboard`, `/admin/assets/new`)

### 1.1 Session and lobby flow

- Create a session with a generated code to share with players.
- Join an existing session using code + username.
- Move into a lobby and then the play screen.
- Session routes are protected so users without a valid session are redirected home.

### 1.2 Main play screen layout

The in-session layout has three zones:

- **Center:** Map canvas (the active battle map)
- **Left (GM only):** GM Controls panel
- **Right:** Player utility panel (chat, dice, notes, inventory, drawing, etc.)

Header features include:

- Session name + session code
- Active map name
- Realtime connection status indicator
- Player count
- Claim/release GM role
- Collapse/expand right panel
- Leave session

### 1.3 Player features

Players can use the right-side tabs to access:

- **Chat:** shared session chat
- **Dice:** in-app dice rolling with roll logs
- **Initiative:** (player-focused view) initiative tracker
- **Notes:** shared notepad space
- **Items:** inventory interactions
- **Draw:** map annotation tools
- **Session:** quick layout/help panel

### 1.4 GM features

GM controls are grouped in dedicated tabs:

- **Maps:** map management and active map selection
- **PCs:** character management
- **NPCs:** NPC template/instance management
- **Handouts:** session handout management
- **Fog:** fog of war controls/tools
- **Initiative:** GM initiative tracker controls
- **Settings:** gameplay permissions + drawing cleanup + session export/import

GM settings include toggles for:

- Allow players to rename NPCs
- Allow players to move NPCs

GM utility actions include:

- Clearing all drawings (or only player drawings from the player draw tab)
- Session export/import support

### 1.5 Realtime and persistence behavior

- Session data is persisted in Supabase Postgres.
- Map/token/handout assets use Supabase Storage public buckets.
- Realtime table updates sync state across connected users.
- Client state is managed via Zustand stores and synchronized through domain hooks.

---

## 2) Admin page feature guide

The Admin UI supports lightweight system moderation and global asset curation.

### 2.1 Admin login

- Password-based admin sign-in at `/admin`.
- Password is checked against `system_settings.admin_password`.
- Successful login creates a local admin session and records an admin log entry.

> Important: the default seeded admin password is `tempest-admin-2024` from migration `003_admin_and_assets.sql`. Change it immediately.

### 2.2 Admin dashboard tabs

- **Sessions**
  - View all sessions
  - Expand to inspect players + session metadata
  - Remove players from sessions
  - Delete sessions

- **Global Assets**
  - View all global map/token assets
  - Delete assets
  - Navigate to add-new asset workflow

- **Activity Logs**
  - Review admin action history

- **Settings**
  - Change admin password

### 2.3 Global asset creation

`/admin/assets/new` supports:

- Asset type selection (`token` or `map`)
- Image upload + preview
- Validation rules (size/dimensions/type)
- Category/tags/metadata
- Upload to storage and save record into `global_assets`

---

## 3) Prerequisites

- **Git**
- **GitHub account**
- **Node.js 18+** (Node 20 LTS recommended)
- **npm 9+**
- **Supabase account**
- **Cloudflare account** (for Pages deployment)

---

## 4) Fork + clone your own copy

1. Open the repository on GitHub.
2. Click **Fork** → choose your account/org.
3. Clone your fork:

```bash
git clone https://github.com/<your-username>/StormlightVTT.git
cd StormlightVTT
```

4. (Recommended) Add upstream remote:

```bash
git remote add upstream https://github.com/<original-owner>/StormlightVTT.git
git remote -v
```

---

## 5) Create Supabase project

1. In Supabase dashboard, click **New project**.
2. Choose org, project name, database password, region.
3. Wait for provisioning.
4. Copy API values from **Project Settings → API**:
   - `Project URL`
   - `anon public` key

---

## 6) Run database/storage migrations

You can run these in Supabase SQL Editor as separate scripts, in order:

1. `001_initial_schema.sql`
2. `002_storage_setup.sql`
3. `003_admin_and_assets.sql`
4. `004_initiative_and_gm_settings.sql`
5. `005_initiative_roll_logs_and_unique_entries.sql`
6. `006_add_drawing_data.sql`
7. `007_handouts_and_folders.sql`
8. `008_handouts_storage.sql`
9. `009_token_size_and_status_rings.sql`

### 6.1 Notes about storage policies

The storage migrations create buckets/policies for:

- `maps`
- `tokens`
- `handouts`

If your project already has similarly named policies, Supabase may raise policy-name conflicts. If that happens:

- remove conflicting policy names first, or
- rename policies in your SQL before running.

---

## 7) Local development setup

1. Install dependencies:

```bash
npm install
```

2. Create your local env file:

```bash
cp .env.example .env.local
```

3. Fill in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

4. Start dev server:

```bash
npm run dev
```

5. Open the app at `http://localhost:5173`.

---

## 8) Cloudflare Pages deployment (from your fork)

### 8.1 Connect repo to Cloudflare Pages

1. Go to **Cloudflare Dashboard → Workers & Pages → Create application → Pages**.
2. Choose **Connect to Git**.
3. Authorize GitHub if prompted.
4. Select your **fork** repository.

### 8.2 Configure build settings

Use:

- **Framework preset:** Vite (or None + manual commands)
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node version:** 20 (recommended)

### 8.3 Add environment variables in Pages

In Pages project settings, add for both **Preview** and **Production** environments:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then redeploy.

### 8.4 SPA routing note

Tempest Table uses client-side routes (e.g. `/play`, `/admin/dashboard`).

For Cloudflare Pages, add a `public/_redirects` file containing:

```text
/* /index.html 200
```

This ensures direct-link refreshes on nested routes resolve correctly.

---

## 9) Dev vs production secret/variable strategy (Cloudflare)

Even though Vite `VITE_*` values are client-exposed, you should still maintain clean environment separation.

### 9.1 Recommended setup

- **Preview environment**
  - Use a separate Supabase project (staging/dev)
  - Set Preview vars to staging values

- **Production environment**
  - Use your production Supabase project
  - Set Production vars to production values

### 9.2 Where to set values

In Cloudflare Pages:

- **Pages project → Settings → Environment variables**
  - Add variables per environment (Preview/Production)

Optional CLI workflow (`wrangler pages`) can also manage deployments, but dashboard setup is usually fastest.

### 9.3 Security expectations

- `VITE_SUPABASE_ANON_KEY` is intended for public client usage.
- Do **not** place Supabase service role keys in Vite `VITE_*` variables.
- Admin authentication in this app is app-level/password-based, so change default password immediately and restrict who gets it.

---

## 10) Post-deploy checklist

- [ ] Session create/join works
- [ ] Realtime sync works across two browser windows
- [ ] Map/token uploads work
- [ ] Handout uploads work
- [ ] Admin login works
- [ ] Default admin password changed
- [ ] Cloudflare Preview + Production env vars both set
- [ ] SPA route refresh (`/play`, `/admin/dashboard`) works

---

## 11) Helpful operational notes

- Supabase free tier can pause inactive projects; first request after idle may be slow.
- Keep migrations versioned and run them in order for each new environment.
- For production stability, pin Node version in Cloudflare Pages.
- Consider maintaining a small seed/testing session in staging to validate releases.
