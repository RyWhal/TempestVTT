# Medium Token Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GM-only per-map Medium token baseline, derive all token rendering from it, and preserve that setting in map export data.

**Architecture:** Add a new `medium_token_scale` field on maps, expose it through the existing map hydration and update flows, and centralize token size math in a shared helper. Use that helper in both the canvas token renderer and the GM map-settings preview so the live board and preview stay in sync without storing custom per-token scales.

**Tech Stack:** TypeScript, React 18, Zustand, Supabase, Vitest, Testing Library, React Konva, Tailwind, ripgrep

---

## Assumptions

- Implementation happens on a feature branch or worktree created from the current repo state
- `mediumTokenScale` defaults to `1` for all existing maps and test fixtures
- Session import remains preview-only in this phase; compatibility means exported JSON includes the new field and the preview parser tolerates it
- UI range stays clamped to `0.25` through `3` with `0.05` slider increments

## File Structure

### New files

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/supabase/migrations/014_map_medium_token_scale.sql`
  Adds the `medium_token_scale` column with a safe default and positive-value guard.

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/lib/tokenSizing.ts`
  Shared token footprint math for map preview and live token rendering.

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/lib/tokenSizing.test.ts`
  Regression coverage for the size formula and clamping behavior.

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/types/index.test.ts`
  Regression coverage for map hydration and `SessionExport` map-shape defaults.

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/gm/MapManager.test.tsx`
  GM settings test coverage for the new control, preview labels, and save payload.

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/Token.test.tsx`
  Rendering regression test proving token footprint uses the new baseline.

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/lib/sessionExport.ts`
  Pure helper that builds exported session payloads so export coverage stays unit-testable.

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/lib/sessionExport.test.ts`
  Export regression coverage for `mediumTokenScale`.

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/gm/SessionExport.test.tsx`
  Import-preview compatibility test for JSON that includes `mediumTokenScale`.

### Existing files to modify

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/types/index.ts`
  Extend `Map`, `DbMap`, `SessionExport`, and `dbMapToMap`.

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useMap.ts`
  Allow `updateMapSettings` to send `mediumTokenScale`.

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/gm/MapManager.tsx`
  Add the new control, preview, and settings-state wiring.

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/Token.tsx`
  Use shared token-size math instead of hardcoded `gridCellSize * multiplier`.

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/MapCanvas.tsx`
  Pass the map’s `mediumTokenScale` into every token render.

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/gm/SessionExport.tsx`
  Delegate export payload construction to the helper and keep the import preview compatible.

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlaySession.test.tsx`
  Update map fixtures to include `mediumTokenScale: 1`.

### Existing test files likely touched by type fallout

- `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/__tests__/useSession.test.tsx`
  Add `medium_token_scale` to any mocked `DbMap` rows if TypeScript or runtime assertions require it.

## Task 1: Add the map field, hydration defaults, and shared token size helper

**Files:**
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/supabase/migrations/014_map_medium_token_scale.sql`
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/types/index.test.ts`
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/lib/tokenSizing.ts`
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/lib/tokenSizing.test.ts`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/types/index.ts`

- [ ] **Step 1: Write the failing map hydration test**

Create `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/types/index.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { dbMapToMap } from './index';

describe('dbMapToMap', () => {
  it('hydrates mediumTokenScale from the db row', () => {
    const map = dbMapToMap({
      id: 'map_001',
      session_id: 'session_001',
      name: 'Room One',
      image_url: 'https://example.com/map.png',
      width: 1000,
      height: 800,
      sort_order: 0,
      created_at: '2026-04-06T00:00:00.000Z',
      grid_enabled: true,
      grid_offset_x: 0,
      grid_offset_y: 0,
      grid_cell_size: 50,
      grid_color: '#000000',
      medium_token_scale: 1.25,
      fog_enabled: false,
      fog_default_state: 'revealed',
      fog_data: [],
      drawing_data: [],
      effects_enabled: false,
      effect_data: [],
      show_player_tokens: true,
    });

    expect(map.mediumTokenScale).toBe(1.25);
  });
});
```

- [ ] **Step 2: Run the hydration test to verify it fails**

Run:

```bash
npm run test:run -- src/types/index.test.ts
```

Expected: FAIL because `DbMap`, `Map`, or `dbMapToMap` do not yet include `mediumTokenScale`

- [ ] **Step 3: Write the failing shared sizing test**

Create `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/lib/tokenSizing.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { getTokenPixelSize } from './tokenSizing';

describe('getTokenPixelSize', () => {
  it('derives size from grid cell size, medium scale, and token multiplier', () => {
    expect(getTokenPixelSize({ gridCellSize: 50, mediumTokenScale: 1.2, size: 'large' })).toBe(120);
    expect(getTokenPixelSize({ gridCellSize: 50, mediumTokenScale: 1.2, size: 'tiny' })).toBe(30);
  });
});
```

- [ ] **Step 4: Run the sizing test to verify it fails**

Run:

```bash
npm run test:run -- src/lib/tokenSizing.test.ts
```

Expected: FAIL because `src/lib/tokenSizing.ts` does not exist yet

- [ ] **Step 5: Implement the minimal data-model and helper changes**

Add `/Users/nonomaybeyes/Documents/projects/StormlightVTT/supabase/migrations/014_map_medium_token_scale.sql`:

```sql
ALTER TABLE maps
ADD COLUMN IF NOT EXISTS medium_token_scale DOUBLE PRECISION DEFAULT 1;

UPDATE maps
SET medium_token_scale = COALESCE(medium_token_scale, 1)
WHERE medium_token_scale IS NULL;

ALTER TABLE maps
ADD CONSTRAINT maps_medium_token_scale_positive
CHECK (medium_token_scale > 0);
```

Add `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/lib/tokenSizing.ts`:

```ts
import { TOKEN_SIZE_MULTIPLIERS, type TokenSize } from '../types';

export const DEFAULT_MEDIUM_TOKEN_SCALE = 1;

export const clampMediumTokenScale = (value: number) =>
  Math.min(3, Math.max(0.25, Number.isFinite(value) ? value : DEFAULT_MEDIUM_TOKEN_SCALE));

export const getTokenPixelSize = ({
  gridCellSize,
  mediumTokenScale,
  size,
}: {
  gridCellSize: number;
  mediumTokenScale: number;
  size: TokenSize;
}) => gridCellSize * clampMediumTokenScale(mediumTokenScale) * TOKEN_SIZE_MULTIPLIERS[size];
```

Update `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/types/index.ts` to:

- add `mediumTokenScale: number` to `Map`
- add `medium_token_scale: number` to `DbMap`
- add `mediumTokenScale: number` inside `SessionExport.maps[].gridSettings`
- map `db.medium_token_scale ?? 1` into `Map.mediumTokenScale`

- [ ] **Step 6: Run the focused tests to verify they pass**

Run:

```bash
npm run test:run -- src/types/index.test.ts src/lib/tokenSizing.test.ts
```

Expected: PASS with both tests green

- [ ] **Step 7: Commit the data-model foundation**

```bash
git add supabase/migrations/014_map_medium_token_scale.sql src/types/index.ts src/types/index.test.ts src/lib/tokenSizing.ts src/lib/tokenSizing.test.ts
git commit -m "feat: add medium token scale map model"
```

## Task 2: Persist the new map setting through `useMap.updateMapSettings`

**Files:**
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/__tests__/useMap.test.tsx`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useMap.ts`

- [ ] **Step 1: Write the failing `useMap` persistence test**

Create `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/__tests__/useMap.test.tsx` with:

```tsx
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMap } from '../useMap';

const { updateMock, eqMock, fromMock } = vi.hoisted(() => {
  const eqMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
  return {
    updateMock,
    eqMock,
    fromMock: vi.fn(() => ({ update: updateMock })),
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from: fromMock },
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  STORAGE_BUCKETS: {},
}));

describe('useMap.updateMapSettings', () => {
  beforeEach(() => {
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockClear();
  });

  it('persists mediumTokenScale to the maps table', async () => {
    let updateMapSettings: ReturnType<typeof useMap>['updateMapSettings'] | null = null;
    const Harness = () => {
      updateMapSettings = useMap().updateMapSettings;
      return null;
    };
    renderToString(<Harness />);

    await updateMapSettings?.('map_001', { mediumTokenScale: 1.35 });

    expect(updateMock).toHaveBeenCalledWith({ medium_token_scale: 1.35 });
    expect(eqMock).toHaveBeenCalledWith('id', 'map_001');
  });
});
```

- [ ] **Step 2: Run the hook test to verify it fails**

Run:

```bash
npm run test:run -- src/hooks/__tests__/useMap.test.tsx
```

Expected: FAIL because `updateMapSettings` currently ignores `mediumTokenScale`

- [ ] **Step 3: Implement the minimal hook change**

Update `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/useMap.ts` so the `Pick<Map, ...>` for `updateMapSettings` includes `mediumTokenScale`, and add:

```ts
if (settings.mediumTokenScale !== undefined) {
  dbSettings.medium_token_scale = settings.mediumTokenScale;
}
```

- [ ] **Step 4: Run the hook test to verify it passes**

Run:

```bash
npm run test:run -- src/hooks/__tests__/useMap.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the persistence wiring**

```bash
git add src/hooks/useMap.ts src/hooks/__tests__/useMap.test.tsx
git commit -m "feat: persist medium token scale in map settings"
```

## Task 3: Add the GM map-settings control and preview

**Files:**
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/gm/MapManager.test.tsx`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/gm/MapManager.tsx`

- [ ] **Step 1: Write the failing GM settings test**

Create `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/gm/MapManager.test.tsx` with:

```tsx
/* @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MapManager } from './MapManager';

const updateMapSettingsMock = vi.fn().mockResolvedValue({ success: true });

vi.mock('../../hooks/useMap', () => ({
  useMap: () => ({
    maps: [{
      id: 'map_001',
      sessionId: 'session_001',
      name: 'Room One',
      imageUrl: 'https://example.com/map.png',
      width: 1000,
      height: 1000,
      sortOrder: 0,
      createdAt: '2026-04-06T00:00:00.000Z',
      gridEnabled: true,
      gridOffsetX: 0,
      gridOffsetY: 0,
      gridCellSize: 50,
      gridColor: '#000000',
      mediumTokenScale: 1.2,
      fogEnabled: false,
      fogDefaultState: 'revealed',
      fogData: [],
      drawingData: [],
      effectsEnabled: false,
      effectData: [],
      showPlayerTokens: true,
    }],
    activeMap: null,
    uploadMap: vi.fn(),
    addMapFromGlobalAsset: vi.fn(),
    setMapActive: vi.fn(),
    updateMapSettings: updateMapSettingsMock,
    deleteMap: vi.fn(),
  }),
}));

vi.mock('../shared/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

describe('MapManager medium token scale', () => {
  beforeEach(() => {
    updateMapSettingsMock.mockClear();
  });

  it('saves the per-map medium token scale and shows the derived preview labels', async () => {
    const user = userEvent.setup();
    render(<MapManager />);

    await user.click(screen.getByRole('button', { name: /settings/i }));

    expect(screen.getByRole('spinbutton', { name: /default medium token size/i })).toHaveValue(1.2);
    expect(screen.getByText(/tiny/i)).not.toBeNull();
    expect(screen.getByText(/gargantuan/i)).not.toBeNull();

    await user.clear(screen.getByRole('spinbutton', { name: /default medium token size/i }));
    await user.type(screen.getByRole('spinbutton', { name: /default medium token size/i }), '1.35');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(updateMapSettingsMock).toHaveBeenCalledWith('map_001', expect.objectContaining({
      mediumTokenScale: 1.35,
    }));
  });
});
```

- [ ] **Step 2: Run the GM settings test to verify it fails**

Run:

```bash
npm run test:run -- src/components/gm/MapManager.test.tsx
```

Expected: FAIL because the control and preview do not exist yet

- [ ] **Step 3: Implement the minimal UI changes**

Update `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/gm/MapManager.tsx` to:

- extend `MapSettingsData` with `mediumTokenScale`
- seed local settings state from `map.mediumTokenScale`
- add a labeled number input with `min="0.25"`, `max="3"`, `step="0.05"`, and accessible name `Default Medium Token Size`
- add a matching range input bound to the same state with accessible name `Default Medium Token Size Slider`
- render preview labels for `tiny`, `small`, `medium`, `large`, `huge`, and `gargantuan`
- compute preview footprints with `getTokenPixelSize`

Use a local parser like:

```ts
const parseMediumScale = (value: string) => clampMediumTokenScale(parseFloat(value));
```

- [ ] **Step 4: Run the GM settings test to verify it passes**

Run:

```bash
npm run test:run -- src/components/gm/MapManager.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the GM settings UI**

```bash
git add src/components/gm/MapManager.tsx src/components/gm/MapManager.test.tsx
git commit -m "feat: add medium token scale gm control"
```

## Task 4: Apply the new baseline in live token rendering

**Files:**
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/Token.test.tsx`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/Token.tsx`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/MapCanvas.tsx`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlaySession.test.tsx`

- [ ] **Step 1: Write the failing token rendering test**

Create `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/Token.test.tsx` with mocked Konva primitives:

```tsx
/* @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Token } from './Token';

vi.mock('use-image', () => ({ default: () => [null] }));
vi.mock('react-konva', () => ({
  Group: ({ children }: any) => <div>{children}</div>,
  Circle: (props: any) => <div data-testid="token-circle" data-radius={props.radius} />,
  Text: (props: any) => <div>{props.text}</div>,
  Image: () => <div />,
  Ring: () => <div />,
}));

describe('Token medium scale rendering', () => {
  it('uses mediumTokenScale when computing footprint', () => {
    render(
      <Token
        id="char_001"
        type="character"
        name="Kaladin"
        imageUrl={null}
        x={0}
        y={0}
        size="large"
        gridCellSize={50}
        mediumTokenScale={1.2}
        isSelected={false}
        isDraggable={false}
        isHidden={false}
        isGM={true}
        onSelect={() => {}}
        onDragEnd={() => {}}
      />
    );

    expect(screen.getByTestId('token-circle')).toHaveAttribute('data-radius', '60');
  });
});
```

- [ ] **Step 2: Run the token rendering test to verify it fails**

Run:

```bash
npm run test:run -- src/components/map/Token.test.tsx
```

Expected: FAIL because `Token` does not accept `mediumTokenScale` yet

- [ ] **Step 3: Implement the minimal rendering change**

Update `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/Token.tsx`:

- add `mediumTokenScale: number` to `TokenProps`
- replace `gridCellSize * TOKEN_SIZE_MULTIPLIERS[size]` with `getTokenPixelSize({ gridCellSize, mediumTokenScale, size })`

Update `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/map/MapCanvas.tsx`:

- derive `const mediumTokenScale = activeMap?.mediumTokenScale ?? 1`
- pass `mediumTokenScale={mediumTokenScale}` to every `<Token />`

Update `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlaySession.test.tsx` to add `mediumTokenScale: 1` to the mocked active map.

- [ ] **Step 4: Run the rendering-focused tests to verify they pass**

Run:

```bash
npm run test:run -- src/components/map/Token.test.tsx src/components/play/PlaySession.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit the canvas integration**

```bash
git add src/components/map/Token.tsx src/components/map/Token.test.tsx src/components/map/MapCanvas.tsx src/components/play/PlaySession.test.tsx
git commit -m "feat: derive live token size from medium scale"
```

## Task 5: Preserve the map baseline in exported session data and import preview parsing

**Files:**
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/lib/sessionExport.ts`
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/lib/sessionExport.test.ts`
- Create: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/gm/SessionExport.test.tsx`
- Modify: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/gm/SessionExport.tsx`

- [ ] **Step 1: Write the failing export payload test**

Create `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/lib/sessionExport.test.ts` with:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildSessionExport } from './sessionExport';

describe('buildSessionExport', () => {
  it('includes mediumTokenScale inside exported grid settings', async () => {
    const exportData = await buildSessionExport({
      session: { name: 'Shared Table', notepadContent: '' },
      maps: [{
        id: 'map_001',
        sessionId: 'session_001',
        name: 'Room One',
        imageUrl: 'https://example.com/map.png',
        width: 1000,
        height: 1000,
        sortOrder: 0,
        createdAt: '2026-04-06T00:00:00.000Z',
        gridEnabled: true,
        gridOffsetX: 0,
        gridOffsetY: 0,
        gridCellSize: 50,
        gridColor: '#000000',
        mediumTokenScale: 1.4,
        fogEnabled: false,
        fogDefaultState: 'revealed',
        fogData: [],
        drawingData: [],
        effectsEnabled: false,
        effectData: [],
        showPlayerTokens: true,
      }],
      characters: [],
      npcTemplates: [],
      npcInstances: [],
      fetchAsBase64: vi.fn().mockResolvedValue('data:image/png;base64,AAA'),
    });

    expect(exportData.maps[0].gridSettings.mediumTokenScale).toBe(1.4);
  });
});
```

- [ ] **Step 2: Run the export payload test to verify it fails**

Run:

```bash
npm run test:run -- src/lib/sessionExport.test.ts
```

Expected: FAIL because `buildSessionExport` does not exist yet

- [ ] **Step 3: Implement the minimal export helper and wiring**

Add `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/lib/sessionExport.ts`:

```ts
import type { SessionExport, Character, Map, NPCInstance, NPCTemplate, Session } from '../types';

export const buildSessionExport = async ({
  session,
  maps,
  characters,
  npcTemplates,
  npcInstances,
  fetchAsBase64,
}: {
  session: Pick<Session, 'name' | 'notepadContent'>;
  maps: Map[];
  characters: Character[];
  npcTemplates: NPCTemplate[];
  npcInstances: NPCInstance[];
  fetchAsBase64: (url: string) => Promise<string>;
}): Promise<SessionExport> => {
  // move the current export assembly logic here and include gridSettings.mediumTokenScale
};
```

Update `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/gm/SessionExport.tsx` to:

- replace the inline `mapsWithImages` assembly with `buildSessionExport(...)`
- keep `handleImportFile` as preview-only
- add `aria-label="Import Session File"` to the hidden file input
- avoid any behavior change beyond including the new field in exported JSON

- [ ] **Step 4: Write the failing import preview compatibility test**

Create `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/gm/SessionExport.test.tsx` with:

```tsx
/* @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionExport } from './SessionExport';

const showToastMock = vi.fn();

vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: (selector: any) => selector({
    session: { id: 'session_001', name: 'Shared Table', notepadContent: '' },
  }),
}));

vi.mock('../../stores/mapStore', () => ({
  useMapStore: (selector: any) => selector({
    maps: [],
    characters: [],
    npcTemplates: [],
    npcInstances: [],
  }),
}));

vi.mock('../shared/Toast', () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

describe('SessionExport import preview', () => {
  it('accepts exported map JSON that includes mediumTokenScale', async () => {
    render(<SessionExport />);

    const input = screen.getByLabelText(/import session file/i);
    const file = new File([JSON.stringify({
      version: '1.0',
      exportedAt: '2026-04-06T00:00:00.000Z',
      session: { name: 'Shared Table', notepadContent: '' },
      maps: [{
        name: 'Room One',
        imageBase64: '',
        width: 1000,
        height: 1000,
        gridSettings: {
          enabled: true,
          offsetX: 0,
          offsetY: 0,
          cellSize: 50,
          color: '#000000',
          mediumTokenScale: 1.3,
        },
        fogSettings: { enabled: false, defaultState: 'revealed', fogData: [] },
        showPlayerTokens: true,
        npcInstances: [],
      }],
      characters: [],
      npcTemplates: [],
    })], 'session.json', { type: 'application/json' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(expect.stringMatching(/import preview/i), 'info');
    });
  });
});
```

- [ ] **Step 5: Run the export and import-preview tests to verify they pass**

Run:

```bash
npm run test:run -- src/lib/sessionExport.test.ts src/components/gm/SessionExport.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit the export compatibility changes**

```bash
git add src/lib/sessionExport.ts src/lib/sessionExport.test.ts src/components/gm/SessionExport.tsx src/components/gm/SessionExport.test.tsx
git commit -m "feat: preserve medium token scale in session exports"
```

## Task 6: Run final verification and fix any type fallout

**Files:**
- Modify as needed: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/play/PlaySession.test.tsx`
- Modify as needed: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/hooks/__tests__/useSession.test.tsx`
- Modify as needed: `/Users/nonomaybeyes/Documents/projects/StormlightVTT/src/components/gm/MapManager.test.tsx`

- [ ] **Step 1: Run the focused feature test suite**

Run:

```bash
npm run test:run -- src/types/index.test.ts src/lib/tokenSizing.test.ts src/hooks/__tests__/useMap.test.tsx src/components/gm/MapManager.test.tsx src/components/map/Token.test.tsx src/lib/sessionExport.test.ts src/components/gm/SessionExport.test.tsx src/components/play/PlaySession.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run the app-wide build**

Run:

```bash
npm run build
```

Expected: exit code `0`

- [ ] **Step 3: Fix any fixture fallout immediately**

If the build or tests fail because existing map fixtures are missing the new field, add `mediumTokenScale: 1` or `medium_token_scale: 1` to the affected mock objects instead of weakening the types.

- [ ] **Step 4: Re-run verification after the fixes**

Run:

```bash
npm run test:run -- src/types/index.test.ts src/lib/tokenSizing.test.ts src/hooks/__tests__/useMap.test.tsx src/components/gm/MapManager.test.tsx src/components/map/Token.test.tsx src/lib/sessionExport.test.ts src/components/gm/SessionExport.test.tsx src/components/play/PlaySession.test.tsx
npm run build
```

Expected: all targeted tests pass and the build succeeds

- [ ] **Step 5: Commit the final verified feature**

```bash
git add supabase/migrations/014_map_medium_token_scale.sql src/types/index.ts src/types/index.test.ts src/lib/tokenSizing.ts src/lib/tokenSizing.test.ts src/hooks/useMap.ts src/hooks/__tests__/useMap.test.tsx src/components/gm/MapManager.tsx src/components/gm/MapManager.test.tsx src/components/map/Token.tsx src/components/map/Token.test.tsx src/components/map/MapCanvas.tsx src/components/gm/SessionExport.tsx src/components/gm/SessionExport.test.tsx src/lib/sessionExport.ts src/lib/sessionExport.test.ts src/components/play/PlaySession.test.tsx
git commit -m "feat: add per-map medium token scale"
```
