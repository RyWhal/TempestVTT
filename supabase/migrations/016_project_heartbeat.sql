-- Record a harmless daily write so low-traffic projects remain operational.

CREATE TABLE public.project_heartbeat (
  id text PRIMARY KEY CHECK (id = 'cloudflare-cron'),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  run_count bigint NOT NULL DEFAULT 0 CHECK (run_count >= 0)
);

ALTER TABLE public.project_heartbeat ENABLE ROW LEVEL SECURITY;

INSERT INTO public.project_heartbeat (id)
VALUES ('cloudflare-cron');

CREATE OR REPLACE FUNCTION public.app_record_project_heartbeat(p_token text)
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
    AND encode(sha256(convert_to(p_token, 'UTF8')), 'hex') =
      'REPLACE_WITH_SHA256_HEARTBEAT_TOKEN'
  RETURNING project_heartbeat.last_seen_at, project_heartbeat.run_count;
$$;

REVOKE ALL ON FUNCTION public.app_record_project_heartbeat(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_record_project_heartbeat(text) FROM anon;
REVOKE ALL ON FUNCTION public.app_record_project_heartbeat(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.app_record_project_heartbeat(text) TO anon;
