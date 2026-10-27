-- GM-controlled token display opacity, shared through session realtime updates.
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS token_opacity DOUBLE PRECISION DEFAULT 1;

UPDATE public.sessions SET token_opacity = 1 WHERE token_opacity IS NULL;

ALTER TABLE public.sessions
ALTER COLUMN token_opacity SET DEFAULT 1,
ALTER COLUMN token_opacity SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_token_opacity_range'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
    ADD CONSTRAINT sessions_token_opacity_range CHECK (token_opacity >= 0 AND token_opacity <= 1);
  END IF;
END
$$;
