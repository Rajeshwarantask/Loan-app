-- Add full_name column to loans table
ALTER TABLE loans ADD COLUMN full_name TEXT;

-- Populate full_name from profiles table
UPDATE loans
SET full_name = p.full_name
FROM profiles p
WHERE loans.user_id = p.id;

-- Make full_name NOT NULL and add default
ALTER TABLE loans 
ALTER COLUMN full_name SET NOT NULL,
ALTER COLUMN full_name SET DEFAULT 'Unknown';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_loans_full_name ON loans(full_name);
