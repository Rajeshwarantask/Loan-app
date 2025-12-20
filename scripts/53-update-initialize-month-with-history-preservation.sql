-- Drop existing function
DROP FUNCTION IF EXISTS initialize_new_month(TEXT, UUID);

-- Recreate function with history preservation
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
  v_total_loan_taken NUMERIC;
  v_principal_collected NUMERIC;
  v_interest_collected NUMERIC;
  v_monthly_emi_collected NUMERIC;
  v_monthly_subscription NUMERIC;
  v_total_income_current_month NUMERIC;
  v_previous_month_total_income NUMERIC;
  v_previous_month_total_loan_outstanding NUMERIC;
  v_total_loan_outstanding NUMERIC;
  v_difference NUMERIC;
  v_penalty NUMERIC;
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
  -- This preserves all past month data for reports and audits
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
  WHERE period_key != p_period_key; -- Archive all periods except the one being initialized

  -- Now delete existing records for this period to allow re-initialization
  DELETE FROM monthly_loan_records 
  WHERE period_key = p_period_key;

  -- Get all users with loans (active or paid)
  FOR v_user_record IN
    SELECT DISTINCT p.id as user_id, p.member_id, p.full_name
    FROM profiles p
    INNER JOIN loans l ON l.user_id = p.id
    ORDER BY p.id
  LOOP
    -- Get current loan amount (remaining balance)
    SELECT COALESCE(SUM(remaining_balance), 0)
    INTO v_total_loan_taken
    FROM loans
    WHERE user_id = v_user_record.user_id;

    -- Get principal collected from payments for THIS month using period_key
    SELECT COALESCE(SUM(principal_paid), 0)
    INTO v_principal_collected
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
      AND period_key = p_period_key;

    -- Get interest collected from payments for THIS month using period_key
    SELECT COALESCE(SUM(interest_paid), 0)
    INTO v_interest_collected
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
      AND period_key = p_period_key;

    -- Get monthly EMI collected from payments for THIS month using period_key
    SELECT COALESCE(SUM(monthly_emi), 0)
    INTO v_monthly_emi_collected
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
      AND period_key = p_period_key;

    -- Get monthly subscription from payments for THIS month using period_key
    SELECT COALESCE(SUM(monthly_subscription), 0)
    INTO v_monthly_subscription
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
      AND period_key = p_period_key;

    -- Calculate penalty (if any penalty tracking system is in place)
    v_penalty := 0;

    -- Calculate total income for current month (principal + interest + emi + subscription)
    v_total_income_current_month := v_principal_collected + v_interest_collected + v_monthly_emi_collected + v_monthly_subscription;

    -- Fetch previous month's record from HISTORY table first, then fallback to current table
    SELECT *
    INTO v_previous_month_record
    FROM monthly_loan_records_history
    WHERE user_id = v_user_record.user_id
      AND period_key = v_previous_period_key
    ORDER BY archived_at DESC
    LIMIT 1;

    -- If not found in history, check current table (for first-time initialization)
    IF v_previous_month_record IS NULL THEN
      SELECT *
      INTO v_previous_month_record
      FROM monthly_loan_records
      WHERE user_id = v_user_record.user_id
        AND period_key = v_previous_period_key;
    END IF;

    -- Set previous month values
    IF v_previous_month_record IS NOT NULL THEN
      v_previous_month_total_income := v_previous_month_record.total_income_current_month;
      v_previous_month_total_loan_outstanding := v_previous_month_record.total_loan_outstanding;
    ELSE
      v_previous_month_total_income := 0;
      v_previous_month_total_loan_outstanding := 0;
    END IF;

    -- Calculate outstanding balance (current remaining balance)
    v_total_loan_outstanding := v_total_loan_taken;

    -- Calculate difference
    v_difference := v_total_income_current_month - v_previous_month_total_income;

    -- Calculate available loan amount as Total Pool (400,000) - Outstanding Balance
    v_available_loan_amount := 400000 - v_total_loan_outstanding;

    -- Insert monthly record only if user has payments or previous balance
    IF v_total_income_current_month > 0 OR v_previous_month_total_loan_outstanding > 0 OR v_total_loan_outstanding > 0 THEN
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
        v_total_loan_outstanding,
        v_principal_collected,
        v_interest_collected,
        0,
        v_total_loan_outstanding,
        v_monthly_emi_collected,
        v_monthly_subscription,
        v_total_income_current_month,
        v_previous_month_total_income,
        v_difference,
        v_previous_month_total_loan_outstanding,
        v_penalty,
        v_available_loan_amount,
        'active',
        v_period_year,
        v_period_month,
        p_period_key
      );
    END IF;
  END LOOP;
END;
$$;
