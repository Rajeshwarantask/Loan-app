-- ============================================================================
-- NORMALIZED MONTHLY LOAN CYCLE SYSTEM
-- Based on technical specification: single source of truth with computed views
-- ============================================================================

-- ============================================================================
-- STEP 1: Clean up old schema (drop conflicting tables/views)
-- ============================================================================

DROP VIEW IF EXISTS monthly_cycle_summary CASCADE;
DROP VIEW IF EXISTS cash_bill_data CASCADE;

-- Drop monthly_reconciliation as both view and table to handle both cases
DROP VIEW IF EXISTS monthly_reconciliation CASCADE;
DROP TABLE IF EXISTS monthly_reconciliation CASCADE;

-- ============================================================================
-- STEP 2: Normalize loan_payments table (single source of truth)
-- ============================================================================

-- Add period tracking columns if they don't exist
ALTER TABLE loan_payments ADD COLUMN IF NOT EXISTS period_year INT;
ALTER TABLE loan_payments ADD COLUMN IF NOT EXISTS period_month INT;
ALTER TABLE loan_payments ADD COLUMN IF NOT EXISTS period_key TEXT;

-- Add payment classification if it doesn't exist
ALTER TABLE loan_payments ADD COLUMN IF NOT EXISTS principal_component NUMERIC(12,2) DEFAULT 0;
ALTER TABLE loan_payments ADD COLUMN IF NOT EXISTS interest_component NUMERIC(12,2) DEFAULT 0;
ALTER TABLE loan_payments ADD COLUMN IF NOT EXISTS penalty_component NUMERIC(12,2) DEFAULT 0;
ALTER TABLE loan_payments ADD COLUMN IF NOT EXISTS subscription_component NUMERIC(12,2) DEFAULT 0;

-- Backfill period fields from existing data
UPDATE loan_payments 
SET 
  period_year = EXTRACT(YEAR FROM payment_date)::INT,
  period_month = EXTRACT(MONTH FROM payment_date)::INT,
  period_key = TO_CHAR(payment_date, 'YYYY-MM')
WHERE period_key IS NULL;

-- Backfill components based on payment_type
UPDATE loan_payments
SET
  principal_component = CASE WHEN payment_type IN ('principal', 'emi') THEN COALESCE(principal_paid, 0) ELSE 0 END,
  interest_component = CASE WHEN payment_type IN ('interest', 'emi') THEN COALESCE(interest_paid, 0) ELSE 0 END
WHERE principal_component IS NULL OR interest_component IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_loan_payments_user_period ON loan_payments(user_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_date ON loan_payments(loan_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_loan_payments_period_key ON loan_payments(period_key);

-- ============================================================================
-- STEP 3: Ensure monthly_loan_records has proper unique constraint
-- ============================================================================

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'monthly_loan_records_user_month_year_unique'
  ) THEN
    ALTER TABLE monthly_loan_records 
    ADD CONSTRAINT monthly_loan_records_user_month_year_unique 
    UNIQUE (user_id, month_year);
  END IF;
END $$;

-- Add missing columns
ALTER TABLE monthly_loan_records ADD COLUMN IF NOT EXISTS period_year INT;
ALTER TABLE monthly_loan_records ADD COLUMN IF NOT EXISTS period_month INT;
ALTER TABLE monthly_loan_records ADD COLUMN IF NOT EXISTS period_key TEXT;

-- Backfill period fields
UPDATE monthly_loan_records
SET
  period_year = year_number,
  period_month = month_number,
  period_key = month_year
WHERE period_key IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_monthly_records_period ON monthly_loan_records(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_monthly_records_user ON monthly_loan_records(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_records_period_key ON monthly_loan_records(period_key);

-- ============================================================================
-- STEP 4: Create monthly_cycle_summary VIEW (frontend-ready aggregation)
-- ============================================================================

CREATE OR REPLACE VIEW monthly_cycle_summary AS
SELECT 
  mlr.id,
  mlr.user_id,
  p.member_id as member_id,
  p.full_name,
  p.email,
  
  -- Period info
  mlr.period_key,
  TO_CHAR(TO_DATE(mlr.period_key || '-01', 'YYYY-MM-DD'), 'Mon YYYY') as month_label,
  mlr.period_year,
  mlr.period_month,
  
  -- Balances
  COALESCE(mlr.opening_outstanding, 0) as opening_outstanding,
  COALESCE(mlr.closing_outstanding, 0) as closing_outstanding,
  
  -- Current month data
  COALESCE(mlr.monthly_subscription, 0) as total_subscription,
  COALESCE(mlr.total_loan_taken, 0) as total_loan_taken,
  COALESCE(mlr.new_loan_taken, 0) as new_loans_issued_last_month,
  COALESCE(mlr.principal_paid, 0) as total_principal_paid,
  COALESCE(mlr.interest_paid, 0) as total_interest_paid,
  COALESCE(mlr.penalty, 0) as penalty_income,
  COALESCE(mlr.interest_due, 0) as monthly_interest_income,
  COALESCE(mlr.monthly_installment_income, 0) as monthly_installment_income,
  COALESCE(mlr.total_monthly_income, 0) as total_income_current_month,
  
  -- Historical comparison
  COALESCE(mlr.previous_month_principal_received, 0) as previous_month_principal_received,
  COALESCE(mlr.previous_month_interest_income, 0) as previous_month_interest_income,
  COALESCE(mlr.previous_month_total_income, 0) as previous_month_total_income,
  COALESCE(mlr.previous_month_total_loan_outstanding, 0) as previous_month_total_loan_outstanding,
  COALESCE(mlr.income_difference, 0) as difference,
  
  -- Computed
  COALESCE(mlr.available_loan_amount, 400000 - mlr.closing_outstanding) as available_loan,
  
  -- Status
  mlr.status,
  mlr.created_at,
  mlr.updated_at
FROM monthly_loan_records mlr
INNER JOIN profiles p ON p.id = mlr.user_id
ORDER BY p.member_id ASC;

-- ============================================================================
-- STEP 5: Create refresh function for monthly_loan_records
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_monthly_records(target_period_key TEXT)
RETURNS void AS $$
DECLARE
  target_year INT;
  target_month INT;
  prev_period_key TEXT;
  member_record RECORD;
BEGIN
  -- Parse period_key
  target_year := SPLIT_PART(target_period_key, '-', 1)::INT;
  target_month := SPLIT_PART(target_period_key, '-', 2)::INT;
  
  -- Calculate previous month
  IF target_month = 1 THEN
    prev_period_key := (target_year - 1) || '-12';
  ELSE
    prev_period_key := target_year || '-' || LPAD((target_month - 1)::TEXT, 2, '0');
  END IF;
  
  -- For each member, update their monthly record
  FOR member_record IN (SELECT id, monthly_subscription FROM profiles WHERE role = 'member')
  LOOP
    -- Use (user_id, month_year) for ON CONFLICT to match existing unique constraint
    INSERT INTO monthly_loan_records (
      user_id,
      period_year,
      period_month,
      period_key,
      year_number,
      month_number,
      month_year,
      monthly_subscription,
      total_loan_taken,
      opening_outstanding,
      principal_paid,
      interest_paid,
      penalty,
      interest_due,
      monthly_installment_income,
      total_monthly_income,
      closing_outstanding,
      previous_month_principal_received,
      previous_month_interest_income,
      previous_month_total_income,
      previous_month_total_loan_outstanding,
      income_difference,
      available_loan_amount,
      new_loan_taken
    )
    SELECT 
      member_record.id as user_id,
      target_year,
      target_month,
      target_period_key,
      target_year,
      target_month,
      target_period_key,
      COALESCE(member_record.monthly_subscription, 0),
      
      -- Total loan taken (all time)
      COALESCE((SELECT SUM(amount) FROM loans WHERE user_id = member_record.id), 0),
      
      -- Opening outstanding
      COALESCE(
        (SELECT closing_outstanding FROM monthly_loan_records 
         WHERE user_id = member_record.id AND period_key = prev_period_key),
        (SELECT SUM(principal_remaining) FROM loans WHERE user_id = member_record.id AND status = 'active')
      ),
      
      -- Current month payments
      COALESCE((SELECT SUM(principal_component) FROM loan_payments WHERE user_id = member_record.id AND period_key = target_period_key), 0),
      COALESCE((SELECT SUM(interest_component) FROM loan_payments WHERE user_id = member_record.id AND period_key = target_period_key), 0),
      COALESCE((SELECT SUM(penalty_component) FROM loan_payments WHERE user_id = member_record.id AND period_key = target_period_key), 0),
      
      -- Interest due
      COALESCE((SELECT SUM(outstanding_interest) FROM loans WHERE user_id = member_record.id AND status = 'active'), 0),
      
      -- Monthly installment income
      COALESCE((SELECT SUM(principal_component + interest_component) FROM loan_payments WHERE user_id = member_record.id AND period_key = target_period_key AND payment_type = 'emi'), 0),
      
      -- Total monthly income
      COALESCE((SELECT SUM(amount) FROM loan_payments WHERE user_id = member_record.id AND period_key = target_period_key), 0),
      
      -- Closing outstanding
      COALESCE((SELECT SUM(principal_remaining) FROM loans WHERE user_id = member_record.id AND status = 'active'), 0),
      
      -- Previous month data
      COALESCE((SELECT principal_paid FROM monthly_loan_records WHERE user_id = member_record.id AND period_key = prev_period_key), 0),
      COALESCE((SELECT interest_paid FROM monthly_loan_records WHERE user_id = member_record.id AND period_key = prev_period_key), 0),
      COALESCE((SELECT total_monthly_income FROM monthly_loan_records WHERE user_id = member_record.id AND period_key = prev_period_key), 0),
      COALESCE((SELECT closing_outstanding FROM monthly_loan_records WHERE user_id = member_record.id AND period_key = prev_period_key), 0),
      
      -- Income difference
      COALESCE((SELECT SUM(amount) FROM loan_payments WHERE user_id = member_record.id AND period_key = target_period_key), 0) -
      COALESCE((SELECT total_monthly_income FROM monthly_loan_records WHERE user_id = member_record.id AND period_key = prev_period_key), 0),
      
      -- Available loan
      400000 - COALESCE((SELECT SUM(principal_remaining) FROM loans WHERE user_id = member_record.id AND status = 'active'), 0),
      
      -- New loans taken
      COALESCE((SELECT SUM(amount) FROM loans WHERE user_id = member_record.id AND TO_CHAR(disbursement_date, 'YYYY-MM') = target_period_key), 0)
    
    ON CONFLICT (user_id, month_year) 
    DO UPDATE SET
      period_key = EXCLUDED.period_key,
      period_year = EXCLUDED.period_year,
      period_month = EXCLUDED.period_month,
      monthly_subscription = EXCLUDED.monthly_subscription,
      total_loan_taken = EXCLUDED.total_loan_taken,
      opening_outstanding = EXCLUDED.opening_outstanding,
      principal_paid = EXCLUDED.principal_paid,
      interest_paid = EXCLUDED.interest_paid,
      penalty = EXCLUDED.penalty,
      interest_due = EXCLUDED.interest_due,
      monthly_installment_income = EXCLUDED.monthly_installment_income,
      total_monthly_income = EXCLUDED.total_monthly_income,
      closing_outstanding = EXCLUDED.closing_outstanding,
      previous_month_principal_received = EXCLUDED.previous_month_principal_received,
      previous_month_interest_income = EXCLUDED.previous_month_interest_income,
      previous_month_total_income = EXCLUDED.previous_month_total_income,
      previous_month_total_loan_outstanding = EXCLUDED.previous_month_total_loan_outstanding,
      income_difference = EXCLUDED.income_difference,
      available_loan_amount = EXCLUDED.available_loan_amount,
      new_loan_taken = EXCLUDED.new_loan_taken,
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 6: Create trigger to auto-update monthly_loan_records when payments recorded
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_payment_to_monthly_records()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh the monthly record for this member and period
  PERFORM refresh_monthly_records(NEW.period_key);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_payment_to_monthly_records ON loan_payments;
CREATE TRIGGER trg_sync_payment_to_monthly_records
AFTER INSERT OR UPDATE OR DELETE ON loan_payments
FOR EACH ROW
EXECUTE FUNCTION sync_payment_to_monthly_records();

-- ============================================================================
-- STEP 7: Refresh December 2025 data
-- ============================================================================

SELECT refresh_monthly_records('2025-12');
