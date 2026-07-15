-- Add payment_date to track when payment was partially or fully completed
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_date DATE;
