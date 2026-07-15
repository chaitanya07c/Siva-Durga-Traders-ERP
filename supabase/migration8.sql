-- Add session_id to group bills accurately instead of shop + date
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS session_id UUID DEFAULT uuid_generate_v4();

-- Add session_partial_payment to store the amount paid so far
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS session_partial_payment DECIMAL(12, 2) DEFAULT 0;
