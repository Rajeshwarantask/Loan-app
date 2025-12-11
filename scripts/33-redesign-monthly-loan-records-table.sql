-- Redesign monthly_loan_records table structure
-- Remove unnecessary columns and ensure all required columns exist

BEGIN;

-- Step 1: Check current table structure and remove columns that are not needed
-- Note: We're keeping id, month_year, month_number, year_number for backward compatibility
-- but removing the accounting-specific columns that should be calculated dynamically

-- Remove columns we don't need (if they exist)
-- Note: monthly_subscription is in both remove and add list, so we'll keep it

ALTER TABLE monthly_loan_records 
  DROP COLUMN IF EXISTS opening_outstanding CASCADE;

ALTER TABLE monthly_loan_records 
  DROP COLUMN IF EXISTS interest_due CASCADE;

ALTER TABLE monthly_loan_records 
  DROP COLUMN IF EXISTS interest_paid CASCADE;

ALTER TABLE monthly_loan_records 
  DROP COLUMN IF EXISTS principal_paid CASCADE;

ALTER TABLE monthly_loan_records 
  DROP COLUMN IF EXISTS closing_outstanding CASCADE;

-- Step 2: Add columns if they don't exist
-- user_id
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='user_id') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN user_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- monthly_subscription
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='monthly_subscription') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN monthly_subscription numeric DEFAULT 0;
  END IF;
END $$;

-- total_monthly_income
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='total_monthly_income') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN total_monthly_income numeric DEFAULT 0;
  END IF;
END $$;

-- income_difference
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='income_difference') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN income_difference numeric DEFAULT 0;
  END IF;
END $$;

-- status
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='status') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN status text DEFAULT 'active';
  END IF;
END $$;

-- created_at
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='created_at') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN created_at timestamp with time zone DEFAULT now();
  END IF;
END $$;

-- updated_at
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='updated_at') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN updated_at timestamp with time zone DEFAULT now();
  END IF;
END $$;

-- total_loan_taken
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='total_loan_taken') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN total_loan_taken numeric DEFAULT 0;
  END IF;
END $$;

-- previous_month_principal_received
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='previous_month_principal_received') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN previous_month_principal_received numeric DEFAULT 0;
  END IF;
END $$;

-- new_loan_taken
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='new_loan_taken') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN new_loan_taken numeric DEFAULT 0;
  END IF;
END $$;

-- monthly_installment_income
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='monthly_installment_income') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN monthly_installment_income numeric DEFAULT 0;
  END IF;
END $$;

-- previous_month_interest_income
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='previous_month_interest_income') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN previous_month_interest_income numeric DEFAULT 0;
  END IF;
END $$;

-- previous_month_total_income
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='previous_month_total_income') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN previous_month_total_income numeric DEFAULT 0;
  END IF;
END $$;

-- previous_month_total_loan_outstanding
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='previous_month_total_loan_outstanding') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN previous_month_total_loan_outstanding numeric DEFAULT 0;
  END IF;
END $$;

-- available_loan_amount
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='available_loan_amount') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN available_loan_amount numeric DEFAULT 0;
  END IF;
END $$;

-- period_year
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='period_year') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN period_year integer;
  END IF;
END $$;

-- period_month
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='period_month') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN period_month integer;
  END IF;
END $$;

-- period_key
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='period_key') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN period_key text;
  END IF;
END $$;

-- member_id
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='member_id') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN member_id text;
  END IF;
END $$;

-- penalty
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='monthly_loan_records' AND column_name='penalty') THEN
    ALTER TABLE monthly_loan_records ADD COLUMN penalty numeric DEFAULT 0;
  END IF;
END $$;

-- Step 3: Create or update indexes for better query performance
DROP INDEX IF EXISTS idx_monthly_loan_records_user_period;
CREATE INDEX idx_monthly_loan_records_user_period ON monthly_loan_records(user_id, period_key);

DROP INDEX IF EXISTS idx_monthly_loan_records_member_period;
CREATE INDEX idx_monthly_loan_records_member_period ON monthly_loan_records(member_id, period_key);

DROP INDEX IF EXISTS idx_monthly_loan_records_period;
CREATE INDEX idx_monthly_loan_records_period ON monthly_loan_records(period_key);

COMMIT;

-- Summary of changes:
-- REMOVED: opening_outstanding, interest_due, interest_paid, principal_paid, closing_outstanding
-- KEPT: id, month_year, month_number, year_number (for backward compatibility)
-- ENSURED: All requested columns exist (user_id, monthly_subscription, total_monthly_income, 
--          income_difference, status, created_at, updated_at, total_loan_taken, 
--          previous_month_principal_received, new_loan_taken, monthly_installment_income,
--          previous_month_interest_income, previous_month_total_income, 
--          previous_month_total_loan_outstanding, available_loan_amount, 
--          period_year, period_month, period_key, member_id, penalty)
