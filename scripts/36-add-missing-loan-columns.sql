-- Add missing columns to loans table: purpose, interest_rate, approved_by

ALTER TABLE loans
ADD COLUMN IF NOT EXISTS purpose TEXT,
ADD COLUMN IF NOT EXISTS interest_rate NUMERIC DEFAULT 1.5,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_loans_approved_by ON loans(approved_by);

COMMENT ON COLUMN loans.purpose IS 'Purpose or reason for the loan';
COMMENT ON COLUMN loans.interest_rate IS 'Monthly interest rate percentage (e.g., 1.5 for 1.5%)';
COMMENT ON COLUMN loans.approved_by IS 'Admin user who approved this loan';
