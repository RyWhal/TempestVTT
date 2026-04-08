ALTER TABLE maps
ADD COLUMN IF NOT EXISTS token_size_override_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS medium_token_size_px DOUBLE PRECISION;

UPDATE maps
SET token_size_override_enabled = COALESCE(token_size_override_enabled, FALSE)
WHERE token_size_override_enabled IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'maps'
      AND column_name = 'medium_token_scale'
  ) THEN
    UPDATE maps
    SET
      token_size_override_enabled = CASE
        WHEN COALESCE(medium_token_scale, 1) <> 1 THEN TRUE
        ELSE token_size_override_enabled
      END,
      medium_token_size_px = CASE
        WHEN COALESCE(medium_token_scale, 1) <> 1
          THEN COALESCE(medium_token_size_px, COALESCE(grid_cell_size, 50) * medium_token_scale)
        ELSE medium_token_size_px
      END;

    ALTER TABLE maps DROP CONSTRAINT IF EXISTS maps_medium_token_scale_positive;
    ALTER TABLE maps DROP COLUMN IF EXISTS medium_token_scale;
  END IF;
END $$;

UPDATE maps
SET medium_token_size_px = NULL
WHERE token_size_override_enabled = FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'maps_medium_token_size_px_positive'
  ) THEN
    ALTER TABLE maps
    ADD CONSTRAINT maps_medium_token_size_px_positive
    CHECK (medium_token_size_px IS NULL OR medium_token_size_px > 0);
  END IF;
END $$;
