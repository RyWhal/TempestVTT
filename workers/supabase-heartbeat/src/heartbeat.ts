export interface HeartbeatEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  HEARTBEAT_TOKEN: string;
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

interface HeartbeatRpcRow {
  last_seen_at?: unknown;
  run_count?: unknown;
}

const isValidTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

const parseHeartbeatResponse = (payload: unknown): HeartbeatResult => {
  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new Error('Supabase heartbeat returned an invalid response');
  }

  const row = payload[0] as HeartbeatRpcRow | null;
  if (
    !row ||
    !isValidTimestamp(row.last_seen_at) ||
    !Number.isSafeInteger(row.run_count) ||
    (row.run_count as number) < 0
  ) {
    throw new Error('Supabase heartbeat returned an invalid response');
  }

  return {
    lastSeenAt: row.last_seen_at,
    runCount: row.run_count as number,
  };
};

const redact = (value: string, secrets: string[]): string =>
  secrets.reduce(
    (safeValue, secret) => safeValue.split(secret).join('[REDACTED]'),
    value
  );

export const recordProjectHeartbeat = async (
  env: HeartbeatEnv,
  dependencies: HeartbeatDependencies = {}
): Promise<HeartbeatResult> => {
  const supabaseUrl = env.SUPABASE_URL.trim().replace(/\/+$/, '');
  const anonKey = env.SUPABASE_ANON_KEY.trim();
  const heartbeatToken = env.HEARTBEAT_TOKEN.trim();
  if (!supabaseUrl || !anonKey || !heartbeatToken) {
    throw new Error('Supabase heartbeat configuration is incomplete');
  }

  const fetchImplementation = dependencies.fetch ?? fetch;
  const response = await fetchImplementation(
    `${supabaseUrl}/rest/v1/rpc/app_record_project_heartbeat`,
    {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ p_token: heartbeatToken }),
      signal: AbortSignal.timeout(dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    const responseBody = (await response.text()).slice(0, MAX_ERROR_BODY_LENGTH);
    throw new Error(
      `Supabase heartbeat failed with HTTP ${response.status}: ${redact(responseBody, [anonKey, heartbeatToken])}`
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Supabase heartbeat returned malformed JSON');
  }

  return parseHeartbeatResponse(payload);
};
