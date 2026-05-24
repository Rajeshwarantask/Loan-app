-- Implement Complete Loan Balance Architecture
-- This script establishes loan_payments.remaining_balance as the single source of truth
-- for balance calculations across all periods and reconstructions.

-- Step 1: Add indexes for performance on critical queries
CREATE INDEX IF NOT EXISTS idx_loan_payments_user_period 
  ON loan_payments(user_id, period_year DESC, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_loan_payments_status
  ON loan_payments(user_id, status);

CREATE INDEX IF NOT EXISTS idx_loans_user_status
  ON loans(user_id, status);

CREATE INDEX IF NOT EXISTS idx_monthly_loan_records_user_period
  ON monthly_loan_records(user_id, period_year DESC, period_month DESC);

-- Step 2: Create function to get opening balance for a period
-- Priority: Previous closing → Original loan amount → Reconstruction
DROP FUNCTION IF EXISTS get_opening_balance(UUID, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION get_opening_balance(
  p_user_id UUID,
  p_period_key TEXT
)
RETURNS numeric AS $$
DECLARE
  v_period_year INTEGER;
  v_period_month INTEGER;
  v_prev_period_key TEXT;
  v_prev_year INTEGER;
  v_prev_month INTEGER;
  v_opening_balance numeric;
BEGIN
  -- Parse period_key (YYYY-MM format)
  v_period_year := SUBSTRING(p_period_key, 1, 4)::INTEGER;
  v_period_month := SUBSTRING(p_period_key, 6, 2)::INTEGER;

  -- Calculate previous period
  IF v_period_month = 1 THEN
    v_prev_month := 12;
    v_prev_year := v_period_year - 1;
  ELSE
    v_prev_month := v_period_month - 1;
    v_prev_year := v_period_year;
  END IF;

  v_prev_period_key := v_prev_year || '-' || LPAD(v_prev_month::TEXT, 2, '0');

  -- Priority 1: Use previous period's closing balance as opening balance
  SELECT remaining_balance INTO v_opening_balance
  FROM loan_payments
  WHERE user_id = p_user_id
    AND period_key = v_prev_period_key
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_opening_balance IS NOT NULL THEN
    RETURN v_opening_balance;
  END IF;

  -- Priority 2: Use original_loan_amount if no prior payment exists
  SELECT original_loan_amount INTO v_opening_balance
  FROM loans
  WHERE user_id = p_user_id
    AND status IN ('active', 'subscription_only')
  LIMIT 1;

  IF v_opening_balance IS NOT NULL THEN
    RETURN v_opening_balance;
  END IF;

  -- Priority 3: Reconstruct opening balance
  -- Opening Balance = Sum of (original loan amounts) - (cumulative principal paid before this period)
  SELECT COALESCE(SUM(l.original_loan_amount), 0) 
         - COALESCE(
           (SELECT SUM(lp.monthly_emi + lp.additional_principal)
            FROM loan_payments lp
            WHERE lp.user_id = p_user_id
              AND (lp.period_year < v_period_year 
                   OR (lp.period_year = v_period_year AND lp.period_month < v_period_month))),
           0
         )
  INTO v_opening_balance
  FROM loans l
  WHERE l.user_id = p_user_id
    AND l.status IN ('active', 'subscription_only');

  RETURN COALESCE(v_opening_balance, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 3: Create function to calculate closing balance
-- Closing Balance = Opening Balance - EMI - Additional Principal + New Loan Amount
DROP FUNCTION IF EXISTS calculate_closing_balance(UUID, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION calculate_closing_balance(
  p_user_id UUID,
  p_period_key TEXT
)
RETURNS numeric AS $$
DECLARE
  v_opening_balance numeric;
  v_emi_paid numeric;
  v_additional_principal numeric;
  v_new_loans numeric;
  v_closing_balance numeric;
BEGIN
  -- Get opening balance
  v_opening_balance := get_opening_balance(p_user_id, p_period_key);

  -- Get total EMI paid this period
  SELECT COALESCE(SUM(monthly_emi), 0)
  INTO v_emi_paid
  FROM loan_payments
  WHERE user_id = p_user_id AND period_key = p_period_key;

  -- Get total additional principal paid this period
  SELECT COALESCE(SUM(additional_principal), 0)
  INTO v_additional_principal
  FROM loan_payments
  WHERE user_id = p_user_id AND period_key = p_period_key;

  -- Get new loans added this period
  SELECT COALESCE(SUM(additional_loan_amount), 0)
  INTO v_new_loans
  FROM additional_loan
  WHERE user_id = p_user_id AND period_key = p_period_key;

  -- Formula: Closing = Opening - EMI - Additional Principal + New Loans
  v_closing_balance := v_opening_balance - v_emi_paid - v_additional_principal + v_new_loans;

  RETURN GREATEST(v_closing_balance, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Create function to revert a period with priority-based balance recovery
DROP FUNCTION IF EXISTS revert_period_payment(UUID, TEXT, UUID) CASCADE;

CREATE OR REPLACE FUNCTION revert_period_payment(
  p_user_id UUID,
  p_period_key TEXT,
  p_reverted_by UUID DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_deleted_count INTEGER;
  v_restored_balance numeric;
  v_error_msg TEXT;
BEGIN
  -- Delete all payments for this period
  DELETE FROM loan_payments
  WHERE user_id = p_user_id AND period_key = p_period_key;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No payments found for this period',
      'deleted_count', 0
    );
  END IF;

  -- Restore balance using priority logic
  -- Priority 1: Get balance from payment before this period
  SELECT remaining_balance INTO v_restored_balance
  FROM loan_payments
  WHERE user_id = p_user_id
    AND (
      (SUBSTRING(period_key, 1, 4)::INTEGER < SUBSTRING(p_period_key, 1, 4)::INTEGER)
      OR (
        SUBSTRING(period_key, 1, 4)::INTEGER = SUBSTRING(p_period_key, 1, 4)::INTEGER
        AND SUBSTRING(period_key, 6, 2)::INTEGER < SUBSTRING(p_period_key, 6, 2)::INTEGER
      )
    )
  ORDER BY period_year DESC, period_month DESC
  LIMIT 1;

  IF v_restored_balance IS NULL THEN
    -- Priority 2: Use original_loan_amount
    SELECT original_loan_amount INTO v_restored_balance
    FROM loans
    WHERE user_id = p_user_id AND status IN ('active', 'subscription_only')
    LIMIT 1;
  END IF;

  IF v_restored_balance IS NULL THEN
    -- Priority 3: Reconstruct
    v_restored_balance := get_opening_balance(p_user_id, p_period_key);
  END IF;

  RETURN json_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'restored_balance', v_restored_balance,
    'period_key', p_period_key,
    'message', 'Period reverted successfully'
  );

EXCEPTION WHEN OTHERS THEN
  v_error_msg := SQLERRM;
  RETURN json_build_object(
    'success', false,
    'error', v_error_msg,
    'deleted_count', 0
  );
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create function to synchronize member status
-- Automatically upgrade subscription_only to active when new loan is received
DROP FUNCTION IF EXISTS sync_member_status_on_loan_conversion(UUID) CASCADE;

CREATE OR REPLACE FUNCTION sync_member_status_on_loan_conversion(
  p_user_id UUID
)
RETURNS json AS $$
DECLARE
  v_active_loans INTEGER;
  v_subscription_only_loans INTEGER;
  v_updated_count INTEGER;
BEGIN
  -- Count active loans
  SELECT COUNT(*) INTO v_active_loans
  FROM loans
  WHERE user_id = p_user_id AND status = 'active';

  -- Count subscription_only loans
  SELECT COUNT(*) INTO v_subscription_only_loans
  FROM loans
  WHERE user_id = p_user_id AND status = 'subscription_only';

  -- If user has both active and subscription_only, something is wrong
  -- A user should have only one primary loan record at a time
  IF v_active_loans > 0 AND v_subscription_only_loans > 0 THEN
    -- Update subscription_only to active (they've transitioned)
    UPDATE loans
    SET status = 'active', updated_at = NOW()
    WHERE user_id = p_user_id AND status = 'subscription_only';

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RETURN json_build_object(
      'success', true,
      'action', 'upgraded_to_active',
      'records_updated', v_updated_count,
      'message', 'Member status synchronized from subscription_only to active'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'action', 'no_change_needed',
    'records_updated', 0,
    'message', 'Member status is consistent'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'records_updated', 0
  );
END;
$$ LANGUAGE plpgsql;

-- Step 6: Add trigger to automatically sync member status on loan update
CREATE OR REPLACE FUNCTION trigger_sync_member_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When a subscription_only loan gets a new_loan added (status change to active)
  IF NEW.status = 'active' AND OLD.status = 'subscription_only' THEN
    PERFORM sync_member_status_on_loan_conversion(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_member_status ON loans;
CREATE TRIGGER trg_sync_member_status
AFTER UPDATE ON loans
FOR EACH ROW
EXECUTE FUNCTION trigger_sync_member_status();

-- Step 7: Validate data integrity
-- Check that original_loan_amount is set for all active loans
UPDATE loans
SET original_loan_amount = COALESCE(original_loan_amount, loan_amount)
WHERE original_loan_amount IS NULL
  AND status IN ('active', 'subscription_only');

-- Step 8: Create validation function
DROP FUNCTION IF EXISTS validate_balance_consistency(UUID) CASCADE;

CREATE OR REPLACE FUNCTION validate_balance_consistency(p_user_id UUID)
RETURNS TABLE (
  is_valid BOOLEAN,
  period_key TEXT,
  opening_balance numeric,
  closing_balance numeric,
  calculated_balance numeric,
  variance numeric,
  issue TEXT
) AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT 
      lp.period_key,
      lp.remaining_balance,
      get_opening_balance(p_user_id, lp.period_key) as calc_opening,
      calculate_closing_balance(p_user_id, lp.period_key) as calc_closing
    FROM loan_payments lp
    WHERE lp.user_id = p_user_id
    ORDER BY lp.period_year, lp.period_month
  LOOP
    RETURN QUERY SELECT
      (ABS(rec.remaining_balance - rec.calc_closing) < 1) as is_valid,
      rec.period_key,
      rec.calc_opening,
      rec.remaining_balance,
      rec.calc_closing,
      ABS(rec.remaining_balance - rec.calc_closing),
      CASE 
        WHEN ABS(rec.remaining_balance - rec.calc_closing) >= 1 THEN 'Balance mismatch detected'
        ELSE NULL 
      END;
  END LOOP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
