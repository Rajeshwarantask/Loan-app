-- ============================================================================
-- DATABASE OPTIMIZATION FOR LOAN MANAGEMENT SYSTEM
-- ============================================================================
-- This script implements a ledger-first architecture where transactions_ledger
-- is the single source of truth, and monthly_loan_records are derived snapshots.
-- ============================================================================

-- Step 1: Drop redundant tables and outdated structures
-- ----------------------------------------------------------------------------

-- Remove old loan_payments table (replaced by transactions_ledger)
DROP TABLE IF EXISTS loan_payments CASCADE;

-- Remove monthly_contributions table (now tracked in transactions_ledger)
DROP TABLE IF EXISTS monthly_contributions CASCADE;

-- Remove community_fund table (can be derived from ledger)
DROP TABLE IF EXISTS community_fund CASCADE;


-- Step 2: Enhance transactions_ledger with proper indexes and constraints
-- ----------------------------------------------------------------------------

-- Add missing columns for complete audit trail
ALTER TABLE transactions_ledger 
ADD COLUMN IF NOT EXISTS payment_channel TEXT CHECK (payment_channel IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
ADD COLUMN IF NOT EXISTS receipt_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS allocation_note TEXT,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_ledger_member_date ON transactions_ledger(member_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_ledger_user_date ON transactions_ledger(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_ledger_month ON transactions_ledger(month_year);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON transactions_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_ledger_loan ON transactions_ledger(loan_id) WHERE loan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_deleted ON transactions_ledger(deleted_at) WHERE deleted_at IS NULL;

-- Add check constraint for transaction amounts
ALTER TABLE transactions_ledger 
ADD CONSTRAINT check_positive_amount CHECK (amount >= 0),
ADD CONSTRAINT check_allocation_sum CHECK (
  allocated_to_subscription + allocated_to_penalty + allocated_to_interest + allocated_to_principal <= amount
);


-- Step 3: Enhance monthly_loan_records structure
-- ----------------------------------------------------------------------------

-- Add missing fields for complete tracking
ALTER TABLE monthly_loan_records
ADD COLUMN IF NOT EXISTS expected_subscription NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS expected_interest NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS arrears_subscription NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS arrears_interest NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS arrears_principal NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status TEXT CHECK (payment_status IN ('paid_full', 'paid_partial', 'unpaid', 'overpaid')) DEFAULT 'unpaid';

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_monthly_records_member_month ON monthly_loan_records(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_monthly_records_month ON monthly_loan_records(month_year);
CREATE INDEX IF NOT EXISTS idx_monthly_records_status ON monthly_loan_records(status);
CREATE INDEX IF NOT EXISTS idx_monthly_records_draft ON monthly_loan_records(is_draft) WHERE is_draft = true;


-- Step 4: Enhance loans table
-- ----------------------------------------------------------------------------

-- Add fields for better tracking
ALTER TABLE loans
ADD COLUMN IF NOT EXISTS disbursement_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS expected_closure_date DATE,
ADD COLUMN IF NOT EXISTS actual_closure_date DATE,
ADD COLUMN IF NOT EXISTS total_interest_paid NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_principal_paid NUMERIC DEFAULT 0;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_created ON loans(created_at);


-- Step 5: Create materialized view for member current balances
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS member_current_balance CASCADE;

CREATE MATERIALIZED VIEW member_current_balance AS
SELECT 
  p.id as user_id,
  p.member_id,
  p.full_name,
  p.email,
  p.monthly_subscription,
  
  -- Loan balances from loans table
  COALESCE(SUM(l.principal_remaining), 0) as principal_outstanding,
  COALESCE(SUM(l.outstanding_interest), 0) as interest_outstanding,
  COALESCE(SUM(l.principal_remaining + l.outstanding_interest), 0) as total_outstanding,
  
  -- Payment totals from ledger
  COALESCE(SUM(CASE WHEN tl.transaction_type = 'subscription_payment' THEN tl.amount ELSE 0 END), 0) as total_subscription_paid,
  COALESCE(SUM(CASE WHEN tl.transaction_type = 'loan_payment' THEN tl.allocated_to_interest ELSE 0 END), 0) as total_interest_paid,
  COALESCE(SUM(CASE WHEN tl.transaction_type = 'loan_payment' THEN tl.allocated_to_principal ELSE 0 END), 0) as total_principal_paid,
  COALESCE(SUM(CASE WHEN tl.transaction_type = 'penalty_payment' THEN tl.amount ELSE 0 END), 0) as total_penalty_paid,
  
  -- Loan disbursement totals
  COALESCE(SUM(CASE WHEN tl.transaction_type = 'loan_disbursement' THEN tl.amount ELSE 0 END), 0) as total_loans_taken,
  
  -- Last payment date
  MAX(CASE WHEN tl.transaction_type IN ('subscription_payment', 'loan_payment', 'penalty_payment') 
      THEN tl.transaction_date ELSE NULL END) as last_payment_date,
  
  -- Active loans count
  COUNT(DISTINCT CASE WHEN l.status = 'active' THEN l.id ELSE NULL END) as active_loans_count
  
FROM profiles p
LEFT JOIN loans l ON l.user_id = p.id AND l.status = 'active'
LEFT JOIN transactions_ledger tl ON tl.user_id = p.id AND tl.deleted_at IS NULL
WHERE p.role = 'member'
GROUP BY p.id, p.member_id, p.full_name, p.email, p.monthly_subscription;

-- Create indexes on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_balance_user_id ON member_current_balance(user_id);
CREATE INDEX IF NOT EXISTS idx_member_balance_member_id ON member_current_balance(member_id);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_member_balances()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY member_current_balance;
END;
$$ LANGUAGE plpgsql;


-- Step 6: Create function to record payment with automatic allocation
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION record_payment(
  p_user_id UUID,
  p_amount NUMERIC,
  p_payment_channel TEXT,
  p_receipt_number TEXT,
  p_transaction_date TIMESTAMP WITH TIME ZONE,
  p_month_year TEXT,
  p_notes TEXT,
  p_created_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_member_record RECORD;
  v_allocation JSONB;
  v_remaining NUMERIC;
  v_to_subscription NUMERIC := 0;
  v_to_penalty NUMERIC := 0;
  v_to_interest NUMERIC := 0;
  v_to_principal NUMERIC := 0;
  v_ledger_id UUID;
BEGIN
  -- Get monthly record for this user and month
  SELECT * INTO v_member_record
  FROM monthly_loan_records
  WHERE user_id = p_user_id AND month_year = p_month_year
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No monthly record found for user % and month %', p_user_id, p_month_year;
  END IF;
  
  -- Allocation logic: subscription → penalty → interest → principal
  v_remaining := p_amount;
  
  -- 1. Allocate to subscription arrears first
  IF v_member_record.monthly_subscription > (v_member_record.monthly_subscription - COALESCE(v_member_record.arrears_subscription, 0)) THEN
    v_to_subscription := LEAST(v_remaining, v_member_record.monthly_subscription);
    v_remaining := v_remaining - v_to_subscription;
  END IF;
  
  -- 2. Allocate to penalty
  IF v_remaining > 0 AND COALESCE(v_member_record.penalty, 0) > 0 THEN
    v_to_penalty := LEAST(v_remaining, v_member_record.penalty);
    v_remaining := v_remaining - v_to_penalty;
  END IF;
  
  -- 3. Allocate to interest
  IF v_remaining > 0 AND v_member_record.interest_calculated > 0 THEN
    v_to_interest := LEAST(v_remaining, v_member_record.interest_calculated);
    v_remaining := v_remaining - v_to_interest;
  END IF;
  
  -- 4. Allocate remaining to principal
  IF v_remaining > 0 AND v_member_record.opening_outstanding > 0 THEN
    v_to_principal := LEAST(v_remaining, v_member_record.opening_outstanding);
    v_remaining := v_remaining - v_to_principal;
  END IF;
  
  -- Insert into transactions ledger
  INSERT INTO transactions_ledger (
    user_id,
    member_id,
    transaction_type,
    amount,
    allocated_to_subscription,
    allocated_to_penalty,
    allocated_to_interest,
    allocated_to_principal,
    payment_channel,
    receipt_number,
    transaction_date,
    month_year,
    notes,
    created_by,
    created_at
  )
  VALUES (
    p_user_id,
    (SELECT member_id FROM profiles WHERE id = p_user_id),
    'monthly_payment',
    p_amount,
    v_to_subscription,
    v_to_penalty,
    v_to_interest,
    v_to_principal,
    p_payment_channel,
    p_receipt_number,
    p_transaction_date,
    p_month_year,
    p_notes,
    p_created_by,
    NOW()
  )
  RETURNING id INTO v_ledger_id;
  
  -- Update monthly record
  UPDATE monthly_loan_records
  SET 
    principal_paid = COALESCE(principal_paid, 0) + v_to_principal,
    interest_paid = COALESCE(interest_paid, 0) + v_to_interest,
    penalty = GREATEST(0, COALESCE(penalty, 0) - v_to_penalty),
    total_monthly_income = COALESCE(total_monthly_income, 0) + v_to_subscription + v_to_interest + v_to_principal + v_to_penalty,
    closing_outstanding = opening_outstanding + COALESCE(new_loan_taken, 0) - (COALESCE(principal_paid, 0) + v_to_principal),
    updated_at = NOW()
  WHERE id = v_member_record.id;
  
  -- Update loan balances if principal or interest was paid
  IF v_to_principal > 0 OR v_to_interest > 0 THEN
    -- Fixed UPDATE with LIMIT syntax error by using subquery
    UPDATE loans
    SET 
      principal_remaining = GREATEST(0, principal_remaining - v_to_principal),
      outstanding_interest = GREATEST(0, outstanding_interest - v_to_interest),
      total_principal_paid = COALESCE(total_principal_paid, 0) + v_to_principal,
      total_interest_paid = COALESCE(total_interest_paid, 0) + v_to_interest,
      status = CASE 
        WHEN principal_remaining - v_to_principal <= 0 AND outstanding_interest - v_to_interest <= 0 
        THEN 'completed' 
        ELSE status 
      END,
      actual_closure_date = CASE 
        WHEN principal_remaining - v_to_principal <= 0 AND outstanding_interest - v_to_interest <= 0 
        THEN CURRENT_DATE 
        ELSE actual_closure_date 
      END,
      updated_at = NOW()
    WHERE id = (
      SELECT id 
      FROM loans 
      WHERE user_id = p_user_id AND status = 'active'
      ORDER BY created_at ASC
      LIMIT 1
    );
  END IF;
  
  -- Return allocation details
  RETURN jsonb_build_object(
    'ledger_id', v_ledger_id,
    'total_amount', p_amount,
    'allocated_to_subscription', v_to_subscription,
    'allocated_to_penalty', v_to_penalty,
    'allocated_to_interest', v_to_interest,
    'allocated_to_principal', v_to_principal,
    'remaining_unallocated', v_remaining
  );
  
END;
$$ LANGUAGE plpgsql;


-- Step 7: Update initialize_new_month function to use ledger-first approach
-- ----------------------------------------------------------------------------

-- Drop all versions of initialize_new_month function before recreating
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN 
    SELECT 'DROP FUNCTION IF EXISTS ' || oid::regprocedure || ' CASCADE;' as drop_statement
    FROM pg_proc
    WHERE proname = 'initialize_new_month'
  LOOP
    EXECUTE r.drop_statement;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION initialize_new_month(
  p_month_year TEXT,
  p_created_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_year INTEGER;
  v_month INTEGER;
  v_count INTEGER := 0;
BEGIN
  -- Parse year and month
  v_year := CAST(SPLIT_PART(p_month_year, '-', 1) AS INTEGER);
  v_month := CAST(SPLIT_PART(p_month_year, '-', 2) AS INTEGER);
  
  -- Insert monthly records for all active members
  INSERT INTO monthly_loan_records (
    user_id,
    month_year,
    month_number,
    year_number,
    monthly_subscription,
    opening_outstanding,
    interest_calculated,
    expected_subscription,
    expected_interest,
    closing_outstanding,
    total_monthly_income,
    principal_paid,
    interest_paid,
    penalty,
    new_loan_taken,
    is_draft,
    status,
    created_at,
    updated_at
  )
  SELECT 
    p.id,
    p_month_year,
    v_month,
    v_year,
    COALESCE(p.monthly_subscription, 0),
    -- Opening outstanding = sum of active loan balances
    COALESCE((
      SELECT SUM(principal_remaining + outstanding_interest)
      FROM loans l
      WHERE l.user_id = p.id AND l.status = 'active'
    ), 0),
    -- Interest calculated at 1.5% per month on opening outstanding
    ROUND(COALESCE((
      SELECT SUM(principal_remaining) * 0.015
      FROM loans l
      WHERE l.user_id = p.id AND l.status = 'active'
    ), 0), 2),
    COALESCE(p.monthly_subscription, 0), -- Expected subscription
    ROUND(COALESCE((
      SELECT SUM(principal_remaining) * 0.015
      FROM loans l
      WHERE l.user_id = p.id AND l.status = 'active'
    ), 0), 2), -- Expected interest
    -- Closing outstanding initially equals opening (will update as payments come)
    COALESCE((
      SELECT SUM(principal_remaining + outstanding_interest)
      FROM loans l
      WHERE l.user_id = p.id AND l.status = 'active'
    ), 0),
    0, -- Total monthly income starts at 0
    0, -- Principal paid starts at 0
    0, -- Interest paid starts at 0
    0, -- Penalty starts at 0
    0, -- New loan taken starts at 0
    true, -- is_draft
    'draft',
    NOW(),
    NOW()
  FROM profiles p
  WHERE p.role = 'member'
  AND NOT EXISTS (
    SELECT 1 FROM monthly_loan_records mlr
    WHERE mlr.user_id = p.id AND mlr.month_year = p_month_year
  );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Refresh materialized view
  PERFORM refresh_member_balances();
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Initialized %s records for %s', v_count, p_month_year),
    'records_created', v_count,
    'month_year', p_month_year
  );
END;
$$ LANGUAGE plpgsql;


-- Step 8: Create verification/reconciliation queries
-- ----------------------------------------------------------------------------

-- View to see ledger vs monthly records comparison
CREATE OR REPLACE VIEW monthly_reconciliation AS
SELECT 
  mlr.month_year,
  mlr.user_id,
  p.member_id,
  p.full_name,
  mlr.opening_outstanding as recorded_opening,
  mlr.closing_outstanding as recorded_closing,
  mlr.principal_paid as recorded_principal_paid,
  mlr.interest_paid as recorded_interest_paid,
  
  -- From ledger
  COALESCE(SUM(CASE WHEN tl.transaction_type = 'loan_payment' THEN tl.allocated_to_principal ELSE 0 END), 0) as ledger_principal_paid,
  COALESCE(SUM(CASE WHEN tl.transaction_type = 'loan_payment' THEN tl.allocated_to_interest ELSE 0 END), 0) as ledger_interest_paid,
  
  -- Differences
  mlr.principal_paid - COALESCE(SUM(CASE WHEN tl.transaction_type = 'loan_payment' THEN tl.allocated_to_principal ELSE 0 END), 0) as principal_difference,
  mlr.interest_paid - COALESCE(SUM(CASE WHEN tl.transaction_type = 'loan_payment' THEN tl.allocated_to_interest ELSE 0 END), 0) as interest_difference
  
FROM monthly_loan_records mlr
JOIN profiles p ON p.id = mlr.user_id
LEFT JOIN transactions_ledger tl ON tl.user_id = mlr.user_id 
  AND tl.month_year = mlr.month_year 
  AND tl.deleted_at IS NULL
GROUP BY mlr.id, mlr.month_year, mlr.user_id, p.member_id, p.full_name, 
  mlr.opening_outstanding, mlr.closing_outstanding, mlr.principal_paid, mlr.interest_paid;


-- Grant permissions
GRANT SELECT ON monthly_reconciliation TO authenticated;
GRANT SELECT ON member_current_balance TO authenticated;
GRANT EXECUTE ON FUNCTION record_payment TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_new_month TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_member_balances TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Database optimization complete! Key improvements:';
  RAISE NOTICE '1. Removed redundant tables (loan_payments, monthly_contributions, community_fund)';
  RAISE NOTICE '2. Enhanced transactions_ledger with proper indexes and audit fields';
  RAISE NOTICE '3. Created member_current_balance materialized view for fast queries';
  RAISE NOTICE '4. Implemented record_payment function with automatic allocation';
  RAISE NOTICE '5. Updated initialize_new_month to auto-calculate interest';
  RAISE NOTICE '6. Created reconciliation view for audit trail';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '- Use record_payment() function to record all payments';
  RAISE NOTICE '- Run refresh_member_balances() after batch operations';
  RAISE NOTICE '- Check monthly_reconciliation view for any discrepancies';
END $$;
