-- Harden admin authentication and optimize admin session queries

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure the admin password is stored as a bcrypt hash.
UPDATE system_settings
SET value = crypt(value, gen_salt('bf'))
WHERE key = 'admin_password'
  AND value NOT LIKE '$2%';

-- Server-side admin session store (token hashes only).
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);

ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- No direct row access from client roles.
DROP POLICY IF EXISTS "Allow all on system_settings" ON system_settings;
DROP POLICY IF EXISTS "Allow all on admin_logs" ON admin_logs;
DROP POLICY IF EXISTS "Allow all on admin_sessions" ON admin_sessions;

CREATE OR REPLACE FUNCTION app_is_valid_admin_session(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN FALSE;
  END IF;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  DELETE FROM admin_sessions
  WHERE expires_at < NOW();

  UPDATE admin_sessions
  SET last_activity_at = NOW(),
      expires_at = NOW() + INTERVAL '30 minutes'
  WHERE token_hash = v_hash
    AND expires_at >= NOW();

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION app_require_admin_session(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT app_is_valid_admin_session(p_token) THEN
    RAISE EXCEPTION 'Admin session is invalid or expired';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app_admin_login(p_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_password_hash TEXT;
  v_token TEXT;
BEGIN
  SELECT value INTO v_password_hash
  FROM system_settings
  WHERE key = 'admin_password';

  IF v_password_hash IS NULL OR crypt(p_password, v_password_hash) <> v_password_hash THEN
    RETURN NULL;
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO admin_sessions (token_hash, expires_at)
  VALUES (encode(digest(v_token, 'sha256'), 'hex'), NOW() + INTERVAL '30 minutes');

  INSERT INTO admin_logs (action, details)
  VALUES ('admin_login', '{}'::jsonb);

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION app_admin_logout(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM admin_sessions
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION app_admin_log_action(
  p_token TEXT,
  p_action TEXT,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM app_require_admin_session(p_token);

  INSERT INTO admin_logs (action, details)
  VALUES (p_action, COALESCE(p_details, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION app_admin_change_password(
  p_token TEXT,
  p_current_password TEXT,
  p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_password_hash TEXT;
BEGIN
  PERFORM app_require_admin_session(p_token);

  SELECT value INTO v_password_hash
  FROM system_settings
  WHERE key = 'admin_password';

  IF v_password_hash IS NULL OR crypt(p_current_password, v_password_hash) <> v_password_hash THEN
    RETURN FALSE;
  END IF;

  UPDATE system_settings
  SET value = crypt(p_new_password, gen_salt('bf'))
  WHERE key = 'admin_password';

  INSERT INTO admin_logs (action, details)
  VALUES ('password_changed', '{}'::jsonb);

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION app_admin_get_sessions_with_counts(p_token TEXT)
RETURNS TABLE (
  id UUID,
  code VARCHAR(10),
  name VARCHAR(100),
  active_map_id UUID,
  current_gm_username VARCHAR(50),
  notepad_content TEXT,
  allow_players_rename_npcs BOOLEAN,
  allow_players_move_npcs BOOLEAN,
  enable_initiative_phase BOOLEAN,
  enable_plot_dice BOOLEAN,
  allow_players_drawings BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  player_count BIGINT,
  map_count BIGINT,
  character_count BIGINT,
  last_activity TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM app_require_admin_session(p_token);

  RETURN QUERY
  SELECT
    s.id,
    s.code,
    s.name,
    s.active_map_id,
    s.current_gm_username,
    s.notepad_content,
    s.allow_players_rename_npcs,
    s.allow_players_move_npcs,
    s.enable_initiative_phase,
    s.enable_plot_dice,
    s.allow_players_drawings,
    s.created_at,
    s.updated_at,
    COUNT(DISTINCT sp.id) AS player_count,
    COUNT(DISTINCT m.id) AS map_count,
    COUNT(DISTINCT c.id) AS character_count,
    s.updated_at AS last_activity
  FROM sessions s
  LEFT JOIN session_players sp ON sp.session_id = s.id
  LEFT JOIN maps m ON m.session_id = s.id
  LEFT JOIN characters c ON c.session_id = s.id
  GROUP BY s.id
  ORDER BY s.updated_at DESC;
END;
$$;


CREATE OR REPLACE FUNCTION app_admin_get_logs(
  p_token TEXT,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  action VARCHAR(100),
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM app_require_admin_session(p_token);

  RETURN QUERY
  SELECT al.id, al.action, al.details, al.ip_address, al.created_at
  FROM admin_logs al
  ORDER BY al.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 100), 1);
END;
$$;

-- Improve realtime filtering for npc_instances by adding session_id.
ALTER TABLE npc_instances
ADD COLUMN IF NOT EXISTS session_id UUID;

UPDATE npc_instances ni
SET session_id = m.session_id
FROM maps m
WHERE ni.map_id = m.id
  AND (ni.session_id IS NULL OR ni.session_id <> m.session_id);

ALTER TABLE npc_instances
ALTER COLUMN session_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'npc_instances_session_id_fkey'
  ) THEN
    ALTER TABLE npc_instances
      ADD CONSTRAINT npc_instances_session_id_fkey
      FOREIGN KEY (session_id)
      REFERENCES sessions(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_npc_instances_session ON npc_instances(session_id);

CREATE OR REPLACE FUNCTION sync_npc_instance_session_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT m.session_id INTO NEW.session_id
  FROM maps m
  WHERE m.id = NEW.map_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_npc_instance_session_id ON npc_instances;

CREATE TRIGGER trg_sync_npc_instance_session_id
BEFORE INSERT OR UPDATE OF map_id
ON npc_instances
FOR EACH ROW
EXECUTE FUNCTION sync_npc_instance_session_id();
