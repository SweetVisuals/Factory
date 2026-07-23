-- Add is_important column to inbox_emails table
ALTER TABLE inbox_emails
ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT false;
