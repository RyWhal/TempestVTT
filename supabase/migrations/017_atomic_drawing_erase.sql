-- Remove only the touched drawings from the latest row, under Postgres' row lock.
-- Concurrent eraser strokes cannot restore each other's removed drawings.
CREATE OR REPLACE FUNCTION public.erase_map_drawings(p_map_id uuid, p_drawing_ids text[])
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  UPDATE public.maps SET drawing_data = (
    SELECT COALESCE(jsonb_agg(drawing ORDER BY ordinal), '[]'::jsonb)
    FROM jsonb_array_elements(drawing_data) WITH ORDINALITY AS drawings(drawing, ordinal)
    WHERE NOT (drawing->>'id' = ANY(p_drawing_ids))
  ) WHERE id = p_map_id;
$$;
GRANT EXECUTE ON FUNCTION public.erase_map_drawings(uuid, text[]) TO anon, authenticated;
