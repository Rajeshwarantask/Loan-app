-- =====================================================
-- Script 26: Restructure Database to Use member_id as FK
-- =====================================================
-- This script changes all foreign key references from UUID (profiles.id) 
-- to member_id (V01, V02, V03) for better human readability

-- Step 1: Ensure member_id is unique and indexed in profiles table
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_member_id_key;

ALTER TABLE profiles 
  ADD CONSTRAINT profiles_member_id_key UNIQUE (member_id);

CREATE INDEX IF NOT EXISTS idx_profiles_member_id ON profiles(member_id);

-- Step 2: Add new member_id columns to all tables
-- These will temporarily coexist with user_id columns

-- loans table
ALTER TABLE loans ADD COLUMN IF NOT EXISTS member_id TEXT;
CREATE INDEX IF NOT EXISTS idx_loans_member_id ON loans(member_id);

-- loan_requests table  
ALTER TABLE loan_requests ADD COLUMN IF NOT EXISTS member_id TEXT;
CREATE INDEX IF NOT EXISTS idx_loan_requests_member_id ON loan_requests(member_id);

-- loan_payments table
ALTER TABLE loan_payments ADD COLUMN IF NOT EXISTS member_id TEXT;
CREATE INDEX IF NOT EXISTS idx_loan_payments_member_id ON loan_payments(member_id);

-- monthly_loan_records table
ALTER TABLE monthly_loan_records ADD COLUMN IF NOT EXISTS member_id TEXT;
CREATE INDEX IF NOT EXISTS idx_monthly_loan_records_member_id ON monthly_loan_records(member_id);

-- transactions_ledger already has member_id column, just ensure it's indexed
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_member_id ON transactions_ledger(member_id);

-- Step 3: Backfill member_id values from user_id
UPDATE loans l
SET member_id = p.member_id
FROM profiles p
WHERE l.user_id = p.id
  AND l.member_id IS NULL;

UPDATE loan_requests lr
SET member_id = p.member_id
FROM profiles p
WHERE lr.user_id = p.id
  AND lr.member_id IS NULL;

UPDATE loan_payments lp
SET member_id = p.member_id
FROM profiles p
WHERE lp.user_id = p.id
  AND lp.member_id IS NULL;

UPDATE monthly_loan_records mlr
SET member_id = p.member_id
FROM profiles p
WHERE mlr.user_id = p.id
  AND mlr.member_id IS NULL;

-- transactions_ledger already has member_id, but ensure consistency
UPDATE transactions_ledger tl
SET member_id = p.member_id
FROM profiles p
WHERE tl.user_id = p.id
  AND (tl.member_id IS NULL OR tl.member_id != p.member_id);

-- Step 4: Make member_id NOT NULL
ALTER TABLE loans ALTER COLUMN member_id SET NOT NULL;
ALTER TABLE loan_requests ALTER COLUMN member_id SET NOT NULL;
ALTER TABLE loan_payments ALTER COLUMN member_id SET NOT NULL;
ALTER TABLE monthly_loan_records ALTER COLUMN member_id SET NOT NULL;

-- Step 5: Drop old UUID-based foreign key constraints
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_user_id_fkey;
ALTER TABLE loan_requests DROP CONSTRAINT IF EXISTS loan_requests_user_id_fkey;
ALTER TABLE loan_payments DROP CONSTRAINT IF EXISTS loan_payments_user_id_fkey;
ALTER TABLE monthly_loan_records DROP CONSTRAINT IF EXISTS monthly_loan_records_user_id_fkey;
ALTER TABLE transactions_ledger DROP CONSTRAINT IF EXISTS transactions_ledger_user_id_fkey;

-- Step 6: Add new member_id-based foreign key constraints
ALTER TABLE loans 
  ADD CONSTRAINT loans_member_id_fkey 
  FOREIGN KEY (member_id) 
  REFERENCES profiles(member_id) 
  ON DELETE CASCADE;

ALTER TABLE loan_requests 
  ADD CONSTRAINT loan_requests_member_id_fkey 
  FOREIGN KEY (member_id) 
  REFERENCES profiles(member_id) 
  ON DELETE CASCADE;

ALTER TABLE loan_payments 
  ADD CONSTRAINT loan_payments_member_id_fkey 
  FOREIGN KEY (member_id) 
  REFERENCES profiles(member_id) 
  ON DELETE CASCADE;

ALTER TABLE monthly_loan_records 
  ADD CONSTRAINT monthly_loan_records_member_id_fkey 
  FOREIGN KEY (member_id) 
  REFERENCES profiles(member_id) 
  ON DELETE CASCADE;

ALTER TABLE transactions_ledger 
  ADD CONSTRAINT transactions_ledger_member_id_fkey 
  FOREIGN KEY (member_id) 
  REFERENCES profiles(member_id) 
  ON DELETE CASCADE;

-- Step 7: Update unique constraints to use member_id
ALTER TABLE monthly_loan_records DROP CONSTRAINT IF EXISTS monthly_loan_records_user_id_month_year_key;
ALTER TABLE monthly_loan_records 
  ADD CONSTRAINT monthly_loan_records_member_id_month_year_key 
  UNIQUE (member_id, month_year);

-- Step 8: Recreate the monthly_cycle_summary view to use member_id
DROP VIEW IF EXISTS monthly_cycle_summary CASCADE;

CREATE VIEW monthly_cycle_summary AS
SELECT 
  mlr.id,
  mlr.member_id,  -- Now using member_id instead of user_id
  p.full_name,
  p.email,
  mlr.period_key,
  mlr.period_year,
  mlr.period_month,
  mlr.month_year,
  (to_char(make_date(mlr.period_year, mlr.period_month, 1), 'Mon YYYY')) as month_label,
  mlr.status,
  mlr.opening_outstanding,
  mlr.closing_outstanding,
  mlr.new_loan_taken as new_loans_issued_last_month,
  mlr.monthly_subscription as total_subscription,
  mlr.principal_paid as total_principal_paid,
  mlr.interest_paid as total_interest_paid,
  mlr.penalty,
  mlr.total_monthly_income as total_income_current_month,
  mlr.interest_due as monthly_interest_income,
  mlr.monthly_installment_income,
  mlr.penalty as penalty_income,
  mlr.previous_month_principal_received,
  mlr.previous_month_interest_income,
  mlr.previous_month_total_income,
  mlr.previous_month_total_loan_outstanding,
  mlr.income_difference as difference,
  mlr.total_loan_taken,
  mlr.available_loan_amount as available_loan,
  mlr.created_at,
  mlr.updated_at
FROM monthly_loan_records mlr
JOIN profiles p ON mlr.member_id = p.member_id;

-- Step 9: Update the sync trigger function to use member_id
CREATE OR REPLACE FUNCTION sync_payment_to_monthly_record()
RETURNS TRIGGER AS $$
DECLARE
  v_period_year INT;
  v_period_month INT;
  v_month_year TEXT;
  v_period_key TEXT;
  v_month_number INT;
  v_year_number INT;
BEGIN
  -- Extract period information from payment_date
  v_period_year := EXTRACT(YEAR FROM NEW.payment_date);
  v_period_month := EXTRACT(MONTH FROM NEW.payment_date);
  v_month_year := TO_CHAR(NEW.payment_date, 'YYYY-MM');
  v_period_key := TO_CHAR(NEW.payment_date, 'YYYY-MM');
  v_month_number := v_period_month;
  v_year_number := v_period_year;

  -- Upsert monthly record using member_id
  INSERT INTO monthly_loan_records (
    member_id,  -- Using member_id instead of user_id
    month_year,
    period_key,
    period_year,
    period_month,
    month_number,
    year_number,
    opening_outstanding,
    closing_outstanding,
    principal_paid,
    interest_paid,
    penalty,
    monthly_subscription,
    interest_due,
    total_monthly_income,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.member_id,  -- Using member_id from payment
    v_month_year,
    v_period_key,
    v_period_year,
    v_period_month,
    v_month_number,
    v_year_number,
    0,
    0,
    COALESCE(NEW.principal_paid, 0),
    COALESCE(NEW.interest_paid, 0),
    COALESCE(NEW.penalty_component, 0),
    COALESCE(NEW.subscription_component, 0),
    0,
    COALESCE(NEW.amount, 0),
    'draft',
    NOW(),
    NOW()
  )
  ON CONFLICT (member_id, month_year)  -- Using member_id in conflict resolution
  DO UPDATE SET
    principal_paid = monthly_loan_records.principal_paid + COALESCE(NEW.principal_paid, 0),
    interest_paid = monthly_loan_records.interest_paid + COALESCE(NEW.interest_paid, 0),
    penalty = monthly_loan_records.penalty + COALESCE(NEW.penalty_component, 0),
    monthly_subscription = monthly_loan_records.monthly_subscription + COALESCE(NEW.subscription_component, 0),
    total_monthly_income = monthly_loan_records.total_monthly_income + COALESCE(NEW.amount, 0),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS sync_payment_trigger ON loan_payments;
CREATE TRIGGER sync_payment_trigger
  AFTER INSERT ON loan_payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_payment_to_monthly_record();

-- Step 10: Keep user_id columns for now (for auth references) but they're no longer foreign keys
-- The user_id will only be used for Supabase Auth, while member_id is used for business logic

COMMENT ON COLUMN loans.user_id IS 'Legacy UUID for Supabase Auth reference only';
COMMENT ON COLUMN loans.member_id IS 'Primary business key - human-readable member ID (V01, V02, etc)';

COMMENT ON COLUMN loan_requests.user_id IS 'Legacy UUID for Supabase Auth reference only';
COMMENT ON COLUMN loan_requests.member_id IS 'Primary business key - human-readable member ID (V01, V02, etc)';

COMMENT ON COLUMN loan_payments.user_id IS 'Legacy UUID for Supabase Auth reference only';
COMMENT ON COLUMN loan_payments.member_id IS 'Primary business key - human-readable member ID (V01, V02, etc)';

COMMENT ON COLUMN monthly_loan_records.user_id IS 'Legacy UUID for Supabase Auth reference only';
COMMENT ON COLUMN monthly_loan_records.member_id IS 'Primary business key - human-readable member ID (V01, V02, etc)';

-- Verification query to ensure migration was successful
DO $$
DECLARE
  loan_count INT;
  request_count INT;
  payment_count INT;
  record_count INT;
BEGIN
  SELECT COUNT(*) INTO loan_count FROM loans WHERE member_id IS NOT NULL;
  SELECT COUNT(*) INTO request_count FROM loan_requests WHERE member_id IS NOT NULL;
  SELECT COUNT(*) INTO payment_count FROM loan_payments WHERE member_id IS NOT NULL;
  SELECT COUNT(*) INTO record_count FROM monthly_loan_records WHERE member_id IS NOT NULL;
  
  RAISE NOTICE 'Migration verification:';
  RAISE NOTICE '  Loans with member_id: %', loan_count;
  RAISE NOTICE '  Loan requests with member_id: %', request_count;
  RAISE NOTICE '  Loan payments with member_id: %', payment_count;
  RAISE NOTICE '  Monthly records with member_id: %', record_count;
END $$;
