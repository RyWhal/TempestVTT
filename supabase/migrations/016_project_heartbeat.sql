-- Record a harmless daily write so low-traffic projects remain operational.

CREATE TABLE public.project_heartbeat (
  id text PRIMARY KEY CHECK (id = 'cloudflare-cron'),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  run_count bigint NOT NULL DEFAULT 0 CHECK (run_count >= 0)
);

ALTER TABLE public.project_heartbeat ENABLE ROW LEVEL SECURITY;

INSERT INTO public.project_heartbeat (id)
VALUES ('cloudflare-cron');

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
