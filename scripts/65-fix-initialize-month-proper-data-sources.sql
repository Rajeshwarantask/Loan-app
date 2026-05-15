-- Drop existing function
DROP FUNCTION IF EXISTS initialize_new_month(TEXT, UUID);

-- Recreate function with proper data sources
CREATE OR REPLACE FUNCTION initialize_new_month(p_period_key TEXT, p_created_by UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_year INTEGER;
  v_period_month INTEGER;
  v_user_record RECORD;
  v_opening_balance NUMERIC;
  v_additional_principal NUMERIC;
  v_new_loan_issued NUMERIC;
  v_interest_income NUMERIC;
  v_installment_income NUMERIC;
  v_monthly_subscription NUMERIC;
  v_penalty NUMERIC;
  v_total_income_current_month NUMERIC;
  v_previous_month_total_income NUMERIC;
  v_previous_month_total_loan_outstanding NUMERIC;
  v_total_loan_outstanding NUMERIC;
  v_difference NUMERIC;
  v_available_loan_amount NUMERIC;
  v_previous_period_key TEXT;
  v_previous_month_record RECORD;
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

  -- Archive current month records to history before deleting
  INSERT INTO monthly_loan_records_history (
    id, user_id, member_id, total_loan_taken, additional_principal,
    monthly_interest_income, new_loan_taken, total_loan_outstanding,
    monthly_installment_income, monthly_subscription, total_income_current_month,
    previous_month_total_income, difference, previous_month_total_loan_outstanding,
    penalty, available_loan_amount, status, period_year, period_month,
    period_key, created_at, updated_at, archived_at
  )
  SELECT 
    id, user_id, member_id, total_loan_taken, additional_principal,
    monthly_interest_income, new_loan_taken, total_loan_outstanding,
    monthly_installment_income, monthly_subscription, total_income_current_month,
    previous_month_total_income, difference, previous_month_total_loan_outstanding,
    penalty, available_loan_amount, status, period_year, period_month,
    period_key, created_at, updated_at, now()
  FROM monthly_loan_records
  WHERE period_key != p_period_key;

  -- Delete existing records for this period to allow re-initialization
  DELETE FROM monthly_loan_records 
  WHERE period_key = p_period_key;

  -- Get all users with loans (active or completed)
  FOR v_user_record IN
    SELECT DISTINCT p.id as user_id, p.member_id, p.full_name
    FROM profiles p
    INNER JOIN loans l ON l.user_id = p.id
    ORDER BY p.id
  LOOP
    -- Fetch previous month's record to get opening balance
    SELECT *
    INTO v_previous_month_record
    FROM monthly_loan_records_history
    WHERE user_id = v_user_record.user_id
      AND period_key = v_previous_period_key
    ORDER BY archived_at DESC
    LIMIT 1;

    IF v_previous_month_record IS NULL THEN
      SELECT *
      INTO v_previous_month_record
      FROM monthly_loan_records
      WHERE user_id = v_user_record.user_id
        AND period_key = v_previous_period_key;
    END IF;

    -- Set opening balance from previous month's total_loan_outstanding
    IF v_previous_month_record IS NOT NULL THEN
      v_opening_balance := v_previous_month_record.total_loan_outstanding;
      v_previous_month_total_income := v_previous_month_record.total_income_current_month;
      v_previous_month_total_loan_outstanding := v_previous_month_record.total_loan_outstanding;
    ELSE
      -- First month - get from loans table
      SELECT COALESCE(SUM(loan_amount), 0)
      INTO v_opening_balance
      FROM loans
      WHERE user_id = v_user_record.user_id;
      
      v_previous_month_total_income := 0;
      v_previous_month_total_loan_outstanding := 0;
    END IF;

    -- Get additional principal from loan_payments table for current period
    SELECT COALESCE(SUM(additional_principal), 0)
    INTO v_additional_principal
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
      AND period_key = p_period_key;

    -- Get new loan issued from additional_loan table for current period
    SELECT COALESCE(SUM(additional_loan_amount), 0)
    INTO v_new_loan_issued
    FROM additional_loan
    WHERE user_id = v_user_record.user_id
      AND period_key = p_period_key;

    -- Get interest income from loan_payments for current period
    SELECT COALESCE(SUM(interest_paid), 0)
    INTO v_interest_income
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
      AND period_key = p_period_key;

    -- Get installment (EMI) income from loan_payments for current period
    SELECT COALESCE(SUM(monthly_emi), 0)
    INTO v_installment_income
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
      AND period_key = p_period_key;

    -- Get monthly subscription from loan_payments for current period
    SELECT COALESCE(SUM(monthly_subscription), 0)
    INTO v_monthly_subscription
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
      AND period_key = p_period_key;

    -- Get penalty from loan_payments for current period
    SELECT COALESCE(SUM(penalty), 0)
    INTO v_penalty
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
      AND period_key = p_period_key;

    -- Calculate total loan outstanding
    -- Opening balance + New loan issued - Additional principal - Installment
    v_total_loan_outstanding := v_opening_balance + v_new_loan_issued - v_additional_principal - v_installment_income;
    v_total_loan_outstanding := GREATEST(0, v_total_loan_outstanding);

    -- Calculate total income for current month
    v_total_income_current_month := v_interest_income + v_installment_income + v_monthly_subscription + v_penalty;

    -- Calculate difference
    v_difference := v_total_income_current_month - v_previous_month_total_income;

    -- Calculate available loan amount (400000 - current outstanding)
    v_available_loan_amount := 400000 - v_total_loan_outstanding;

    -- Insert monthly record (only if user has any loan activity)
    IF v_opening_balance > 0 OR v_new_loan_issued > 0 OR v_total_income_current_month > 0 THEN
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
        v_opening_balance,
        v_additional_principal,
        v_interest_income,
        v_new_loan_issued,
        v_total_loan_outstanding,
        v_installment_income,
        v_monthly_subscription,
        v_total_income_current_month,
        v_previous_month_total_income,
        v_difference,
        v_previous_month_total_loan_outstanding,
        v_penalty,
        v_available_loan_amount,
        'draft',
        v_period_year,
        v_period_month,
        p_period_key
      );
    END IF;
  END LOOP;
END;
$$;
