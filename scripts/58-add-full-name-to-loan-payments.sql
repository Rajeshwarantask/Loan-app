-- Add full_name column to loan_payments table
ALTER TABLE loan_payments ADD COLUMN full_name TEXT;

-- Populate full_name from profiles table via user_id
UPDATE loan_payments
SET full_name = p.full_name
FROM profiles p
WHERE loan_payments.user_id = p.id;

-- Make full_name NOT NULL and add default
ALTER TABLE loan_payments 
ALTER COLUMN full_name SET NOT NULL,
ALTER COLUMN full_name SET DEFAULT 'Unknown';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_loan_payments_full_name ON loan_payments(full_name);
