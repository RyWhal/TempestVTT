-- Add flexible token sizing for player characters and optional status ring colors for all tokens
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS size VARCHAR(20) DEFAULT 'medium';

ALTER TABLE characters
ADD COLUMN IF NOT EXISTS status_ring_color VARCHAR(20);

ALTER TABLE npc_instances
ADD COLUMN IF NOT EXISTS status_ring_color VARCHAR(20);

UPDATE characters SET size = 'medium' WHERE size IS NULL;
