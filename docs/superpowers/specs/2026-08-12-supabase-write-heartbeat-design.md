# Supabase Write Heartbeat Design

## Goal

Keep the low-traffic Supabase project active by generating a small, genuine database write each day from Cloudflare, while also providing a basic signal that the database API is reachable.

Supabase currently evaluates Free Plan projects over a seven-day activity window and says that a few application database requests per day are typically sufficient. A daily schedule leaves comfortable margin around that window. The heartbeat is an operational safeguard, not a substitute for a paid Supabase plan when guaranteed availability is required.

## Scope

This change will:

- add one dedicated heartbeat row and a narrowly scoped database function;
- add a standalone Cloudflare Worker with a daily Cron Trigger;
- write a new heartbeat timestamp on every successful run;
- treat unexpected Supabase responses as failures and emit useful logs;
- document configuration, local testing, deployment, and verification.

It will not create or delete Supabase projects, create disposable VTT sessions, modify gameplay data, add alerting integrations, or guarantee that Supabase will never change its inactivity policy.

## Architecture

The repository will gain a small Worker under `workers/supabase-heartbeat/`. It will be independently configured and deployed from the existing Cloudflare Pages frontend.

Once per day, Cloudflare invokes the Worker's `scheduled()` handler. The handler sends an authenticated `POST` request to a Supabase REST RPC endpoint using the project's public anon key. The RPC updates one fixed row and returns the resulting timestamp. The Worker validates both the HTTP response and returned payload before considering the run successful.

The Worker needs only:

- `SUPABASE_URL`, stored as a non-secret Worker variable; and
- `SUPABASE_ANON_KEY`, stored as a Worker secret.

It must not receive a Supabase service-role key.

## Database Design

A migration will create a dedicated `project_heartbeat` table with a singleton row:

- `id`: text primary key constrained to the fixed value `cloudflare-cron`;
- `last_seen_at`: non-null timestamp with time zone;
- `run_count`: non-null bigint incremented on each heartbeat.

The migration seeds the singleton row. Row Level Security will be enabled with no direct client policies, preventing reads or writes through the table API.

The migration will also create `app_record_project_heartbeat()`. The function will:

1. run as `SECURITY DEFINER` with an explicit safe `search_path`;
2. update only the fixed singleton row;
3. set `last_seen_at` to the database's current time;
4. increment `run_count` by one;
5. return the updated timestamp and count;
6. be executable by the `anon` role but not expose arbitrary table mutation.

Calling the function is intentionally harmless and idempotent with respect to application data. Repeated calls only advance operational heartbeat metadata.

## Worker Behavior

The Worker will isolate the Supabase request in a testable function shared by the scheduled handler.

For each scheduled run it will:

1. validate that the URL and anon-key bindings are present;
2. call `/rest/v1/rpc/app_record_project_heartbeat` with the required `apikey`, authorization, and JSON headers;
3. apply a bounded request timeout;
4. reject non-success HTTP responses, malformed JSON, or a response without the expected timestamp and count;
5. log a concise success record without credentials or sensitive headers;
6. throw on failure so Cloudflare records the Cron invocation as failed.

The cron expression will run once per day in UTC. The exact hour is operational rather than product behavior and may be chosen to avoid other scheduled work.

No public HTTP route is required for production. Local scheduled-handler testing will use Wrangler's `/cdn-cgi/handler/scheduled` development endpoint.

## Failure Handling and Observability

Cloudflare's Cron Events and Worker logs are the initial observability mechanism. Success logs will include the returned timestamp and run count. Failure logs will include the response status and a bounded response excerpt when available, but never the anon key or authorization header.

A failed run will not retry within application code. The next daily cron invocation provides the natural retry, avoiding accidental request loops. Several daily opportunities remain before Supabase's inactivity window is reached. Alert delivery is intentionally deferred; it can be added later if logs prove insufficient.

If the Supabase project is already paused, the Worker cannot resume it. The operator must restore it in Supabase and then manually exercise the scheduled handler or wait for the next run.

## Testing

Automated Worker tests will cover:

- a successful RPC response;
- missing environment bindings;
- Supabase non-success responses;
- request timeout or network rejection;
- malformed or structurally invalid success payloads;
- confirmation that logs/errors do not disclose the credential.

Migration verification will confirm that the RPC increments `run_count`, advances `last_seen_at`, and cannot modify gameplay tables. Deployment verification will invoke the scheduled handler once, confirm a successful Cloudflare event, and query the heartbeat row through an authorized database/admin channel to confirm the write.

## Documentation and Operations

The setup documentation will explain how to:

1. apply the migration;
2. configure `SUPABASE_URL`;
3. add `SUPABASE_ANON_KEY` with Wrangler secrets;
4. run Worker tests and a local scheduled invocation;
5. deploy the Worker and Cron Trigger;
6. verify the first production write in Supabase and Cloudflare logs.

The documentation will note that Supabase Pro is the supported guarantee against inactivity pausing and that this heartbeat depends on Supabase continuing to count ordinary application writes as activity.

## Success Criteria

- A Cloudflare Cron Trigger invokes the Worker daily.
- Every successful invocation performs exactly one bounded update to the singleton heartbeat row.
- The Worker uses no service-role or database-password credential.
- Failures are visible in Cloudflare Cron Events/logs without leaking secrets.
- Gameplay and user-created data are untouched.
- Tests and documented manual verification demonstrate the complete scheduled-write path.
