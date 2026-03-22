-- Initiative tracker hardening: prevent duplicate combatants + preserve reroll history

-- One initiative entry per source in a session.
-- For rows with NULL source_id (e.g. player without linked character), use source_name fallback.
CREATE UNIQUE INDEX IF NOT EXISTS idx_initiative_entries_unique_source
  ON initiative_entries(session_id, source_type, COALESCE(source_id::text, source_name));

-- Roll event log to track rerolls and roll history.
CREATE TABLE IF NOT EXISTS initiative_roll_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('player', 'npc')),
  source_id UUID,
  source_name VARCHAR(100) NOT NULL,
  rolled_by_username VARCHAR(50) NOT NULL,
  phase VARCHAR(10) NOT NULL CHECK (phase IN ('fast', 'slow')),
  visibility VARCHAR(20) NOT NULL CHECK (visibility IN ('public', 'gm_only')),
  modifier INT NOT NULL DEFAULT 0,
  roll_value INT NOT NULL,
  total INT NOT NULL,
  entry_id UUID REFERENCES initiative_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_initiative_roll_logs_session
  ON initiative_roll_logs(session_id, created_at DESC);

ALTER TABLE initiative_roll_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on initiative_roll_logs"
  ON initiative_roll_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE initiative_roll_logs;
