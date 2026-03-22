-- Add drawing data storage for maps
ALTER TABLE maps
ADD COLUMN IF NOT EXISTS drawing_data JSONB DEFAULT '[]';
