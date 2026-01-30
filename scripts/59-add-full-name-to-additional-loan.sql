-- Add full_name column to additional_loan table
ALTER TABLE additional_loan ADD COLUMN full_name TEXT;

-- Populate full_name from profiles table via user_id
UPDATE additional_loan
SET full_name = p.full_name
FROM profiles p
WHERE additional_loan.user_id = p.id;

-- Make full_name NOT NULL and add default
ALTER TABLE additional_loan 
ALTER COLUMN full_name SET NOT NULL,
ALTER COLUMN full_name SET DEFAULT 'Unknown';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_additional_loan_full_name ON additional_loan(full_name);
