-- Leases survive session_players deletion on leave. Browser heartbeat every minute;
-- expiry approximates disconnect by the last successful heartbeat (within a minute).
-- Existing sessions use anonymous, client-declared usernames. This validates membership,
-- but is NOT authenticated ownership; it preserves the application's current trust model.
CREATE TABLE public.session_player_accents (
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  username text NOT NULL,
  color text NOT NULL CHECK (color = ANY(ARRAY['#60a5fa','#f472b6','#34d399','#fbbf24','#a78bfa','#22d3ee','#fb923c','#f87171','#a3e635','#e879f9','#2dd4bf','#c4b5fd','#fda4af','#bef264','#93c5fd','#fcd34d'])),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(session_id, username),
  UNIQUE(session_id, color)
);
ALTER TABLE public.session_player_accents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read active accent reservations" ON public.session_player_accents
  FOR SELECT TO anon, authenticated USING (expires_at > now());
GRANT SELECT ON public.session_player_accents TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.session_player_accents FROM anon, authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_player_accents;

CREATE OR REPLACE FUNCTION public.claim_player_accent(p_session_id uuid, p_username text, p_color text DEFAULT NULL)
RETURNS SETOF public.session_player_accents
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  palette text[] := ARRAY['#60a5fa','#f472b6','#34d399','#fbbf24','#a78bfa','#22d3ee','#fb923c','#f87171','#a3e635','#e879f9','#2dd4bf','#c4b5fd','#fda4af','#bef264','#93c5fd','#fcd34d'];
  chosen text;
BEGIN
  -- Serialize allocations in one session, including expiry/reclaim and switches.
  PERFORM 1 FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.session_players WHERE session_id = p_session_id AND username = p_username) THEN
    RAISE EXCEPTION 'Join the session before choosing an accent';
  END IF;
  IF p_color IS NOT NULL AND NOT (p_color = ANY(palette)) THEN
    RAISE EXCEPTION 'Choose a color from the palette';
  END IF;
  SELECT color INTO chosen FROM public.session_player_accents WHERE session_id = p_session_id AND username = p_username;
  DELETE FROM public.session_player_accents WHERE session_id = p_session_id AND expires_at <= now();
  chosen := COALESCE(p_color, chosen);
  IF EXISTS (SELECT 1 FROM public.session_player_accents WHERE session_id = p_session_id AND color = chosen AND username <> p_username) THEN
    IF p_color IS NOT NULL THEN RAISE EXCEPTION 'That color has just been taken. Choose another.'; END IF;
    chosen := NULL;
  END IF;
  IF chosen IS NULL THEN
    SELECT candidate INTO chosen FROM unnest(palette) WITH ORDINALITY AS p(candidate, ordering)
      WHERE NOT EXISTS (SELECT 1 FROM public.session_player_accents a WHERE a.session_id = p_session_id AND a.color = candidate)
      ORDER BY ordering LIMIT 1;
  END IF;
  IF chosen IS NULL THEN RAISE EXCEPTION 'All accent colors are reserved. Try again when one is released.'; END IF;
  INSERT INTO public.session_player_accents VALUES (p_session_id, p_username, chosen, now() + interval '2 hours')
    ON CONFLICT (session_id, username) DO UPDATE SET color = excluded.color, expires_at = excluded.expires_at;
  RETURN QUERY SELECT * FROM public.session_player_accents WHERE session_id = p_session_id AND expires_at > now();
END;
$$;
REVOKE ALL ON FUNCTION public.claim_player_accent(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_player_accent(uuid, text, text) TO anon, authenticated;
