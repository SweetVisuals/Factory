-- Migration: Add campaign_id to saved_lists table
ALTER TABLE saved_lists 
ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_saved_lists_campaign_id ON saved_lists(campaign_id);
