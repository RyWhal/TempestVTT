-- A PC is a persistent character; its placement is independent on each map.
CREATE TABLE public.character_map_placements (
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  position_x double precision NOT NULL DEFAULT 0 CHECK (position_x BETWEEN -1000000 AND 1000000),
  position_y double precision NOT NULL DEFAULT 0 CHECK (position_y BETWEEN -1000000 AND 1000000),
  is_placed boolean NOT NULL DEFAULT true,
  PRIMARY KEY (map_id, character_id)
);
CREATE INDEX character_map_placements_session_idx ON public.character_map_placements(session_id);
ALTER TABLE public.character_map_placements ENABLE ROW LEVEL SECURITY;
-- Preserve the existing open-table model, but reject cross-session references.
CREATE POLICY "Table participants manage placements" ON public.character_map_placements
  FOR ALL USING (true) WITH CHECK (
    EXISTS (SELECT 1 FROM public.maps m WHERE m.id = map_id AND m.session_id = character_map_placements.session_id)
    AND EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.session_id = character_map_placements.session_id)
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_map_placements TO anon, authenticated;
-- Only the active map can be recovered from legacy global coordinates.
INSERT INTO public.character_map_placements (session_id, map_id, character_id, position_x, position_y)
SELECT c.session_id, s.active_map_id, c.id, c.position_x, c.position_y
FROM public.characters c JOIN public.sessions s ON s.id = c.session_id
JOIN public.maps m ON m.id = s.active_map_id AND m.session_id = s.id
WHERE c.position_x BETWEEN -1000000 AND 1000000 AND c.position_y BETWEEN -1000000 AND 1000000;
-- Removal updates is_placed instead of deleting, so filtered realtime subscribers
-- receive a row containing both the session and map IDs.
ALTER PUBLICATION supabase_realtime ADD TABLE public.character_map_placements;
