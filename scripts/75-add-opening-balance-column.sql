-- Add opening_balance column to loan_payments table
-- This column stores the opening balance for each period, enabling accurate interest calculations

-- Step 1: Add opening_balance column (NUMERIC, nullable initially for backfill)
ALTER TABLE loan_payments
ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT NULL;

-- Step 2: Create index for performance on opening_balance queries
CREATE INDEX IF NOT EXISTS idx_loan_payments_opening_balance
  ON loan_payments(user_id, period_key, opening_balance);

-- Step 3: Add comment for documentation
COMMENT ON COLUMN loan_payments.opening_balance IS
  'Opening balance for this payment period. Used to calculate interest due for the period.
   Formula: interest_due = opening_balance × interest_rate / 100';
