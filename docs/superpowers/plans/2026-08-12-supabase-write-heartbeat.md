# Supabase Write Heartbeat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily Cloudflare Worker cron that records a harmless write in Supabase and reports failures through Cloudflare Cron Events and logs.

**Architecture:** A locked-down Supabase RPC owns the singleton heartbeat write; the Worker calls only that RPC with the anon key. Request construction and response validation live in a pure, dependency-injected module so Vitest can cover success, configuration errors, remote errors, malformed payloads, timeouts, and secret-safe diagnostics independently of the scheduled entrypoint.

**Tech Stack:** PostgreSQL/Supabase migrations and PostgREST RPC, Cloudflare Workers Cron Triggers, TypeScript, Wrangler, Vitest.

---

## File Structure

- Create `supabase/migrations/016_project_heartbeat.sql`: singleton table, seed row, locked-down RPC, and grants.
- Create `workers/supabase-heartbeat/src/heartbeat.ts`: environment contract, request timeout, RPC invocation, response validation, and safe errors.
- Create `workers/supabase-heartbeat/src/heartbeat.test.ts`: unit coverage for the request client.
- Create `workers/supabase-heartbeat/src/index.ts`: Cloudflare scheduled handler only.
- Create `workers/supabase-heartbeat/wrangler.jsonc`: Worker entrypoint, compatibility date, URL variable placeholder, and daily cron.
- Create `workers/supabase-heartbeat/tsconfig.json`: Worker-specific TypeScript environment and no-emit check.
- Modify `package.json`: add Worker test/type/deploy scripts and development dependencies.
- Modify `package-lock.json`: lock the new development dependencies.
- Modify `SETUP.md`: include migration 016 and heartbeat setup/deploy/verification instructions.

### Task 1: Add the locked-down Supabase heartbeat RPC

**Files:**
- Create: `supabase/migrations/016_project_heartbeat.sql`
- Modify: `SETUP.md`

- [ ] **Step 1: Write the migration with the singleton table and seed row**

Create `supabase/migrations/016_project_heartbeat.sql` with:

```sql
CREATE TABLE public.project_heartbeat (
  id text PRIMARY KEY CHECK (id = 'cloudflare-cron'),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  run_count bigint NOT NULL DEFAULT 0 CHECK (run_count >= 0)
);

ALTER TABLE public.project_heartbeat ENABLE ROW LEVEL SECURITY;

INSERT INTO public.project_heartbeat (id)
VALUES ('cloudflare-cron');
```

Do not add direct table policies. The RPC is the only client-facing write path.

- [ ] **Step 2: Add the narrowly scoped RPC and explicit grants**

Append:

```sql
CREATE OR REPLACE FUNCTION public.app_record_project_heartbeat()
RETURNS TABLE(last_seen_at timestamptz, run_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.project_heartbeat
  SET
    last_seen_at = clock_timestamp(),
    run_count = project_heartbeat.run_count + 1
  WHERE id = 'cloudflare-cron'
  RETURNING project_heartbeat.last_seen_at, project_heartbeat.run_count;
$$;

REVOKE ALL ON FUNCTION public.app_record_project_heartbeat() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_record_project_heartbeat() FROM anon;
REVOKE ALL ON FUNCTION public.app_record_project_heartbeat() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.app_record_project_heartbeat() TO anon;
```

The explicit `PUBLIC` revoke prevents PostgreSQL's default function-execution grant from broadening access. Do not grant table privileges to `anon`.

- [ ] **Step 3: Add migration 016 to the ordered setup list**

In `SETUP.md`, append this item after migration 015:

```markdown
16. `016_project_heartbeat.sql`
```

If migration 015 is not already listed in the document, add both 015 and 016 in filename order.

- [ ] **Step 4: Verify the migration in a disposable or development Supabase database**

Apply the migration, then run through an admin SQL connection:

```sql
SELECT * FROM public.app_record_project_heartbeat();
SELECT * FROM public.project_heartbeat WHERE id = 'cloudflare-cron';
```

Expected: the RPC returns one row, `run_count` becomes `1`, and `last_seen_at` advances. Confirm that an anon REST request to `/rest/v1/project_heartbeat` is rejected while an anon `POST` to `/rest/v1/rpc/app_record_project_heartbeat` succeeds.

Inspect the stored function definition and privileges:

```sql
SELECT pg_get_functiondef('public.app_record_project_heartbeat()'::regprocedure);
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'app_record_project_heartbeat';
```

Expected: the definition names only `public.project_heartbeat`; `anon` has execute permission, `PUBLIC` and `authenticated` do not, and `anon` has no direct table privileges. This confirms that the RPC has no code path to gameplay tables.

- [ ] **Step 5: Commit the database unit**

```bash
git add supabase/migrations/016_project_heartbeat.sql SETUP.md
git commit -m "feat: add Supabase heartbeat RPC"
```

### Task 2: Build the heartbeat request client test-first

**Files:**
- Create: `workers/supabase-heartbeat/src/heartbeat.test.ts`
- Create: `workers/supabase-heartbeat/src/heartbeat.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add Worker tooling**

Install compatible current releases of Wrangler and Cloudflare Worker types:

```bash
npm install --save-dev wrangler @cloudflare/workers-types
```

Add scripts to `package.json`:

```json
"heartbeat:test": "vitest run workers/supabase-heartbeat/src/heartbeat.test.ts",
"heartbeat:typecheck": "tsc --project workers/supabase-heartbeat/tsconfig.json",
"heartbeat:check": "wrangler deploy --dry-run --config workers/supabase-heartbeat/wrangler.jsonc",
"heartbeat:dev": "wrangler dev --config workers/supabase-heartbeat/wrangler.jsonc",
"heartbeat:deploy": "wrangler deploy --config workers/supabase-heartbeat/wrangler.jsonc"
```

- [ ] **Step 2: Write failing tests for configuration and a successful response**

Create `workers/supabase-heartbeat/src/heartbeat.test.ts` with Node environment and mocked `fetch` tests asserting:

```ts
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { recordProjectHeartbeat } from './heartbeat';

describe('recordProjectHeartbeat', () => {
  it('rejects missing configuration before making a request', async () => {
    const fetchMock = vi.fn<typeof fetch>();

    await expect(
      recordProjectHeartbeat(
        { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' },
        { fetch: fetchMock }
      )
    ).rejects.toThrow('Supabase heartbeat configuration is incomplete');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls the heartbeat RPC and returns its validated result', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([{ last_seen_at: '2026-08-12T14:00:00.000Z', run_count: 7 }]),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    await expect(
      recordProjectHeartbeat(
        { SUPABASE_URL: 'https://example.supabase.co/', SUPABASE_ANON_KEY: 'secret-anon-key' },
        { fetch: fetchMock }
      )
    ).resolves.toEqual({
      lastSeenAt: '2026-08-12T14:00:00.000Z',
      runCount: 7,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/rpc/app_record_project_heartbeat',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

- [ ] **Step 3: Run the focused test to verify it fails**

Run:

```bash
npm run heartbeat:test
```

Expected: FAIL because `./heartbeat` does not exist.

- [ ] **Step 4: Implement the minimal request client and response contract**

Create `workers/supabase-heartbeat/src/heartbeat.ts` around these public types and constants:

```ts
export interface HeartbeatEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export interface HeartbeatResult {
  lastSeenAt: string;
  runCount: number;
}

interface HeartbeatDependencies {
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_ERROR_BODY_LENGTH = 500;
```

Implement `recordProjectHeartbeat(env, dependencies)` to:

- reject blank URL/key values;
- normalize the URL by removing trailing slashes;
- use `AbortSignal.timeout(dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS)`;
- `POST` `{}` to `/rest/v1/rpc/app_record_project_heartbeat`;
- set `apikey`, `Authorization: Bearer ...`, `Content-Type: application/json`, and `Accept: application/json`;
- on non-2xx, read at most the first 500 characters of the response body, redact any occurrence of the configured key, and throw an error containing the status and safe excerpt but no request headers or key;
- require an array containing exactly one object;
- require `last_seen_at` to be a valid timestamp string and `run_count` to be a non-negative safe integer;
- return `{ lastSeenAt, runCount }`.

Keep credentials out of every constructed error message.

- [ ] **Step 5: Run the focused tests to verify they pass**

Run:

```bash
npm run heartbeat:test
```

Expected: PASS for configuration and success tests.

- [ ] **Step 6: Add failing tests for remote errors, invalid payloads, timeouts, and secret safety**

Add tests that assert:

- HTTP 401 rejects with the status and bounded response text;
- `[]`, multiple rows, invalid timestamps, fractional counts, and negative counts reject as malformed responses;
- a fetch rejection caused by timeout propagates as a failed heartbeat;
- neither a remote error nor timeout error contains the configured anon key. The remote-error fixture must deliberately echo the key in its response body to prove redaction works.

Use a custom `timeoutMs` only to make the timeout test fast; production keeps the 10-second default.

- [ ] **Step 7: Run tests to verify the new cases fail, then complete validation**

Run `npm run heartbeat:test` before and after implementing the missing branches.

Expected before: at least one new assertion fails. Expected after: all heartbeat tests pass.

- [ ] **Step 8: Commit the request client**

```bash
git add package.json package-lock.json workers/supabase-heartbeat/src/heartbeat.ts workers/supabase-heartbeat/src/heartbeat.test.ts
git commit -m "feat: add Supabase heartbeat client"
```

### Task 3: Add the Cloudflare scheduled Worker

**Files:**
- Create: `workers/supabase-heartbeat/src/index.ts`
- Create: `workers/supabase-heartbeat/wrangler.jsonc`
- Create: `workers/supabase-heartbeat/tsconfig.json`
- Modify: `workers/supabase-heartbeat/src/heartbeat.test.ts`

- [ ] **Step 1: Write a failing scheduled-handler test**

Add a test that imports the default Worker export and calls `scheduled()` with a fake environment. Assert that a successful invocation logs only the returned timestamp and count, and that a rejected heartbeat makes the handler reject.

The test should use `vi.spyOn(console, 'info')` and restore it after the assertion. It must assert that log arguments do not contain `SUPABASE_ANON_KEY`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm run heartbeat:test
```

Expected: FAIL because `src/index.ts` does not exist.

- [ ] **Step 3: Implement the scheduled entrypoint**

Create `workers/supabase-heartbeat/src/index.ts`:

```ts
import { recordProjectHeartbeat, type HeartbeatEnv } from './heartbeat';

export default {
  async scheduled(
    _controller: ScheduledController,
    env: HeartbeatEnv,
    _ctx: ExecutionContext
  ): Promise<void> {
    const result = await recordProjectHeartbeat(env);
    console.info('Supabase heartbeat recorded', {
      lastSeenAt: result.lastSeenAt,
      runCount: result.runCount,
    });
  },
};
```

Do not catch and swallow errors; a rejection must mark the Cron Event as failed.

- [ ] **Step 4: Add Wrangler configuration**

Create `workers/supabase-heartbeat/wrangler.jsonc`:

```jsonc
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "stormlight-vtt-supabase-heartbeat",
  "main": "src/index.ts",
  "compatibility_date": "2026-08-12",
  "vars": {
    "SUPABASE_URL": "https://REPLACE_WITH_PROJECT_REF.supabase.co"
  },
  "triggers": {
    "crons": ["17 9 * * *"]
  }
}
```

The schedule is 09:17 UTC daily; the non-round minute avoids clustering with jobs commonly scheduled on the hour. Replace the URL placeholder before deployment and never add the key to this file.

- [ ] **Step 5: Verify tests and Worker compilation**

Create `workers/supabase-heartbeat/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

Run:

```bash
npm run heartbeat:test
npm run heartbeat:typecheck
npm run heartbeat:check
```

Expected: all tests PASS, TypeScript reports no errors, and Wrangler dry-run completes without deploying.

- [ ] **Step 6: Commit the scheduled Worker**

```bash
git add workers/supabase-heartbeat/src/index.ts workers/supabase-heartbeat/src/heartbeat.test.ts workers/supabase-heartbeat/wrangler.jsonc workers/supabase-heartbeat/tsconfig.json
git commit -m "feat: schedule daily Supabase heartbeat"
```

### Task 4: Document, verify, and deploy

**Files:**
- Modify: `SETUP.md`

- [ ] **Step 1: Document configuration and local verification**

Add a `Supabase heartbeat Worker` section to `SETUP.md` explaining:

```bash
npm run heartbeat:test
npm run heartbeat:typecheck
npm run heartbeat:check
npm run heartbeat:dev
```

Document local scheduled invocation in another terminal:

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled?format=json"
```

Document that local testing should use a development Supabase project, not production.

- [ ] **Step 2: Document secret setup and deployment**

Include:

```bash
npx wrangler secret put SUPABASE_ANON_KEY --config workers/supabase-heartbeat/wrangler.jsonc
npm run heartbeat:deploy
```

Explain that `SUPABASE_URL` must be replaced with the target project URL before deploy, the anon key must never be committed, Cron schedules use UTC, and trigger changes can take several minutes to propagate.

- [ ] **Step 3: Run the full local verification suite**

Run:

```bash
npm run heartbeat:test
npm run heartbeat:typecheck
npm run test:run
npm run build
npm run heartbeat:check
git diff --check
```

Expected: heartbeat tests, existing suite, frontend build, Worker dry-run, and whitespace validation all succeed.

- [ ] **Step 4: Commit the operational documentation**

```bash
git add SETUP.md
git commit -m "docs: add heartbeat Worker runbook"
```

- [ ] **Step 5: Apply the migration to the intended Supabase project**

Use the Supabase SQL Editor or the repository's established migration process. Run the read-only verification query after applying it:

```sql
SELECT id, last_seen_at, run_count
FROM public.project_heartbeat
WHERE id = 'cloudflare-cron';
```

Expected: exactly one row. Record the current `run_count` for comparison.

- [ ] **Step 6: Configure and deploy the Worker**

Set the correct project URL in `wrangler.jsonc`, add the anon-key secret interactively, and run:

```bash
npm run heartbeat:deploy
```

Expected: Wrangler reports a successful deployment and lists the daily Cron Trigger.

- [ ] **Step 7: Verify the first production write**

Invoke the deployed Worker's scheduled test from the Cloudflare dashboard, or temporarily run the handler against production with explicit operator intent. Then query:

```sql
SELECT id, last_seen_at, run_count
FROM public.project_heartbeat
WHERE id = 'cloudflare-cron';
```

Expected: `run_count` increased by exactly one and `last_seen_at` advanced. Confirm the matching successful event/log in Cloudflare and verify that no credential appears in logs.

- [ ] **Step 8: Final repository check**

Run:

```bash
git status --short
git log -5 --oneline
```

Expected: no unintended changes; the feature is represented by focused commits. Do not claim the remote migration or Worker deployment occurred unless those external steps were actually completed and verified.
