-- Add sequence_step column to inbox_emails table if it doesn't exist
ALTER TABLE inbox_emails 
ADD COLUMN IF NOT EXISTS sequence_step TEXT;
