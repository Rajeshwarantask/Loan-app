-- This script implements the new architecture where:
-- 1. Previous month's remaining_balance becomes current month's loan_amount
-- 2. Additional loans add to BOTH loan_amount and remaining_balance
-- 3. Payments only reduce remaining_balance

-- Create function to carry forward balances at month start
CREATE OR REPLACE FUNCTION carryforward_loan_balances(p_period_key TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan_record RECORD;
BEGIN
  -- For each active loan, set loan_amount = previous remaining_balance
  FOR v_loan_record IN
    SELECT id, user_id, remaining_balance
    FROM loans
    WHERE status = 'active'
  LOOP
    -- Update loan_amount to match remaining_balance (carry forward)
    UPDATE loans
    SET loan_amount = remaining_balance,
        period_key = p_period_key,
        updated_at = NOW()
    WHERE id = v_loan_record.id;
  END LOOP;
END;
$$;

-- Update the initialize_new_month function to use the new architecture
DROP FUNCTION IF EXISTS initialize_new_month(TEXT, UUID);

CREATE OR REPLACE FUNCTION initialize_new_month(p_period_key TEXT, p_created_by UUID)
RETURNS TABLE(success BOOLEAN, message TEXT, records_created INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_year INTEGER;
  v_period_month INTEGER;
  v_user_record RECORD;
  v_total_loan_taken NUMERIC;
  v_additional_principal NUMERIC;
  v_monthly_interest_income NUMERIC;
  v_monthly_installment_income NUMERIC;
  v_monthly_subscription NUMERIC;
  v_total_income_current_month NUMERIC;
  v_previous_month_total_income NUMERIC;
  v_previous_month_total_loan_outstanding NUMERIC;
  v_total_loan_outstanding NUMERIC;
  v_difference NUMERIC;
  v_penalty NUMERIC;
  v_new_loan_taken NUMERIC;
  v_previous_period_key TEXT;
  v_previous_month_record RECORD;
  v_records_created INTEGER := 0;
BEGIN
  -- Extract year and month from period_key (format: YYYY-MM)
  v_period_year := CAST(SPLIT_PART(p_period_key, '-', 1) AS INTEGER);
  v_period_month := CAST(SPLIT_PART(p_period_key, '-', 2) AS INTEGER);

  -- Calculate previous month's period_key
  IF v_period_month = 1 THEN
    v_previous_period_key := (v_period_year - 1) || '-12';
  ELSE
    v_previous_period_key := v_period_year || '-' || LPAD((v_period_month - 1)::TEXT, 2, '0');
  END IF;

  -- STEP 1: Carry forward remaining_balance → loan_amount for all active loans
  PERFORM carryforward_loan_balances(p_period_key);

  -- STEP 2: Delete existing records for this period to allow re-initialization
  DELETE FROM monthly_loan_records WHERE period_key = p_period_key;

  -- STEP 3: Get all users with active loans and create monthly records
  FOR v_user_record IN
    SELECT DISTINCT p.id as user_id, p.member_id, p.full_name
    FROM profiles p
    INNER JOIN loans l ON l.user_id = p.id AND l.status = 'active'
    ORDER BY p.id
  LOOP
    -- Get total current loan amount (after carryforward)
    SELECT COALESCE(SUM(loan_amount), 0)
    INTO v_total_loan_taken
    FROM loans
    WHERE user_id = v_user_record.user_id AND status = 'active';

    -- Get principal paid from current month's payments
    SELECT COALESCE(SUM(principal_paid), 0) + COALESCE(SUM(additional_principal), 0)
    INTO v_additional_principal
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
      AND period_year = v_period_year
      AND period_month = v_period_month;

    -- Get interest income from current month's payments
    SELECT COALESCE(SUM(interest_paid), 0)
    INTO v_monthly_interest_income
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
      AND period_year = v_period_year
      AND period_month = v_period_month;

    -- Get monthly EMI/installment income from current month's payments
    SELECT COALESCE(SUM(monthly_emi), 0)
    INTO v_monthly_installment_income
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
      AND period_year = v_period_year
      AND period_month = v_period_month;

    -- Get monthly subscription from loans
    SELECT COALESCE(SUM(monthly_subscription), 0)
    INTO v_monthly_subscription
    FROM loans
    WHERE user_id = v_user_record.user_id AND status = 'active';

    -- Get new loans taken this month from additional_loan table
    SELECT COALESCE(SUM(additional_loan_amount), 0)
    INTO v_new_loan_taken
    FROM additional_loan
    WHERE user_id = v_user_record.user_id
      AND period_year = v_period_year
      AND period_month = v_period_month;

    -- Calculate penalty (placeholder)
    v_penalty := 0;

    -- Calculate total income for current month
    v_total_income_current_month := v_monthly_subscription + v_monthly_interest_income + v_additional_principal + v_penalty;

    -- Get previous month's record
    SELECT *
    INTO v_previous_month_record
    FROM monthly_loan_records
    WHERE user_id = v_user_record.user_id
      AND period_key = v_previous_period_key;

    -- Set previous month values
    IF v_previous_month_record IS NOT NULL THEN
      v_previous_month_total_income := v_previous_month_record.total_income_current_month;
      v_previous_month_total_loan_outstanding := v_previous_month_record.total_loan_outstanding;
    ELSE
      v_previous_month_total_income := 0;
      v_previous_month_total_loan_outstanding := v_total_loan_taken;
    END IF;

    -- Calculate outstanding balance (current balance)
    SELECT COALESCE(SUM(remaining_balance), 0)
    INTO v_total_loan_outstanding
    FROM loans
    WHERE user_id = v_user_record.user_id AND status = 'active';

    -- Calculate difference
    v_difference := v_total_income_current_month - v_previous_month_total_income;

    -- Insert monthly record
    INSERT INTO monthly_loan_records (
      user_id,
      member_id,
      total_loan_taken,
      additional_principal,
      monthly_interest_income,
      new_loan_taken,
      total_loan_outstanding,
      monthly_installment_income,
      monthly_subscription,
      total_income_current_month,
      previous_month_total_income,
      difference,
      previous_month_total_loan_outstanding,
      penalty,
      available_loan_amount,
      status,
      period_year,
      period_month,
      period_key
    ) VALUES (
      v_user_record.user_id,
      v_user_record.member_id,
      v_total_loan_taken,
      v_additional_principal,
      v_monthly_interest_income,
      v_new_loan_taken,
      v_total_loan_outstanding,
      v_monthly_installment_income,
      v_monthly_subscription,
      v_total_income_current_month,
      v_previous_month_total_income,
      v_difference,
      v_previous_month_total_loan_outstanding,
      v_penalty,
      0,
      'active',
      v_period_year,
      v_period_month,
      p_period_key
    );

    v_records_created := v_records_created + 1;
  END LOOP;

  RETURN QUERY SELECT TRUE, 
    'Successfully created ' || v_records_created || ' monthly records for period ' || p_period_key,
    v_records_created;
END;
$$;
