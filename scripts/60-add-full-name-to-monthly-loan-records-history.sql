-- Add full_name column to monthly_loan_records_history table
ALTER TABLE monthly_loan_records_history ADD COLUMN full_name TEXT;

-- Populate full_name from profiles table via user_id
UPDATE monthly_loan_records_history
SET full_name = p.full_name
FROM profiles p
WHERE monthly_loan_records_history.user_id = p.id;

-- Make full_name NOT NULL and add default
ALTER TABLE monthly_loan_records_history 
ALTER COLUMN full_name SET NOT NULL,
ALTER COLUMN full_name SET DEFAULT 'Unknown';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_monthly_loan_records_history_full_name ON monthly_loan_records_history(full_name);
