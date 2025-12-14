-- Drop existing function
DROP FUNCTION IF EXISTS initialize_new_month(TEXT, UUID);

-- Recreate function with new schema that handles additional_loan table
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

  -- Delete existing records for this period to allow re-initialization
  DELETE FROM monthly_loan_records 
  WHERE period_key = p_period_key;

  -- Get all users with active loans
  FOR v_user_record IN
    SELECT DISTINCT p.id as user_id, p.member_id, p.full_name
    FROM profiles p
    INNER JOIN loans l ON l.user_id = p.id AND l.status = 'active'
    ORDER BY p.id
  LOOP
    -- Get total current loan amount
    SELECT COALESCE(SUM(loan_amount), 0)
    INTO v_total_loan_taken
    FROM loans
    WHERE user_id = v_user_record.user_id AND status = 'active';

    -- Get additional principal from current month's payments
    SELECT COALESCE(SUM(additional_principal), 0)
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

    -- Calculate penalty (if any penalty tracking system is in place)
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

    -- Calculate outstanding balance
    v_total_loan_outstanding := v_total_loan_taken - v_additional_principal;

    -- Calculate difference
    v_difference := v_total_income_current_month - v_previous_month_total_income;

    -- Calculate available loan amount (placeholder - adjust based on your logic)
    v_available_loan_amount := 0;

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
      0,
      v_total_loan_outstanding,
      v_monthly_installment_income,
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
  END LOOP;
END;
$$;
