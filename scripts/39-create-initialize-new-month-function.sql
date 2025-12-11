-- Drop existing function if it exists
DROP FUNCTION IF EXISTS initialize_new_month(TEXT, UUID);

-- Create the initialize_new_month function with corrected logic
CREATE OR REPLACE FUNCTION initialize_new_month(
  p_month_year TEXT,  -- Format: 'YYYY-MM' (e.g., '2025-12')
  p_created_by UUID
)
RETURNS TABLE(
  records_created INTEGER,
  message TEXT
) AS $$
DECLARE
  v_period_year INTEGER;
  v_period_month INTEGER;
  v_period_key TEXT;
  v_user_record RECORD;
  v_records_created INTEGER := 0;
  v_total_loan_taken NUMERIC;
  v_total_loan_outstanding NUMERIC;
  v_monthly_interest_income NUMERIC;
  v_monthly_installment_income NUMERIC;
  v_monthly_subscription NUMERIC;
  v_additional_principal NUMERIC;
  v_penalty NUMERIC;
  v_total_income_current_month NUMERIC;
  v_previous_month_total_income NUMERIC;
  v_difference NUMERIC;
  v_previous_month_total_loan_outstanding NUMERIC;
BEGIN
  -- Parse period_year and period_month from p_month_year
  v_period_year := CAST(SPLIT_PART(p_month_year, '-', 1) AS INTEGER);
  v_period_month := CAST(SPLIT_PART(p_month_year, '-', 2) AS INTEGER);
  v_period_key := p_month_year;

  -- Delete existing records for this period to allow re-initialization
  DELETE FROM monthly_loan_records 
  WHERE period_key = v_period_key;

  -- Loop through all users with active loans
  FOR v_user_record IN 
    SELECT DISTINCT p.id as user_id, p.member_id
    FROM profiles p
    INNER JOIN loans l ON l.user_id = p.id
    WHERE l.status = 'active'
  LOOP
    -- Calculate total_loan_taken (sum of all loan amounts for this user)
    SELECT COALESCE(SUM(loan_amount), 0)
    INTO v_total_loan_taken
    FROM loans
    WHERE user_id = v_user_record.user_id
      AND status = 'active';

    -- Calculate total_loan_outstanding (sum of remaining_balance)
    SELECT COALESCE(SUM(remaining_balance), 0)
    INTO v_total_loan_outstanding
    FROM loans
    WHERE user_id = v_user_record.user_id
      AND status = 'active';

    -- Calculate additional_principal from CURRENT month's payments
    SELECT COALESCE(SUM(additional_principal), 0)
    INTO v_additional_principal
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
      AND period_year = v_period_year
      AND period_month = v_period_month;

    -- Calculate monthly_interest_income from current month
    SELECT COALESCE(SUM(interest_paid), 0)
    INTO v_monthly_interest_income
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
      AND period_year = v_period_year
      AND period_month = v_period_month;

    -- Calculate monthly_installment_income (EMI payments)
    SELECT COALESCE(SUM(monthly_emi), 0)
    INTO v_monthly_installment_income
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
      AND period_year = v_period_year
      AND period_month = v_period_month;

    -- Calculate monthly_subscription (sum from loans table)
    SELECT COALESCE(SUM(monthly_subscription), 0)
    INTO v_monthly_subscription
    FROM loans
    WHERE user_id = v_user_record.user_id
      AND status = 'active';

    -- Calculate penalty (default to 0 for now)
    v_penalty := 0;

    -- Calculate total_income_current_month
    v_total_income_current_month := 
      v_monthly_subscription + 
      v_monthly_interest_income + 
      v_additional_principal + 
      v_penalty;

    -- Get previous month's total income for comparison
    SELECT COALESCE(total_income_current_month, 0)
    INTO v_previous_month_total_income
    FROM monthly_loan_records
    WHERE user_id = v_user_record.user_id
      AND (
        (period_year = v_period_year AND period_month = v_period_month - 1) OR
        (period_year = v_period_year - 1 AND period_month = 12 AND v_period_month = 1)
      )
    ORDER BY period_year DESC, period_month DESC
    LIMIT 1;

    -- Calculate difference
    v_difference := v_total_income_current_month - v_previous_month_total_income;

    -- Get previous month's total loan outstanding
    SELECT COALESCE(total_loan_outstanding, 0)
    INTO v_previous_month_total_loan_outstanding
    FROM monthly_loan_records
    WHERE user_id = v_user_record.user_id
      AND (
        (period_year = v_period_year AND period_month = v_period_month - 1) OR
        (period_year = v_period_year - 1 AND period_month = 12 AND v_period_month = 1)
      )
    ORDER BY period_year DESC, period_month DESC
    LIMIT 1;

    -- Insert record into monthly_loan_records
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
      0, -- new_loan_taken
      v_total_loan_outstanding,
      v_monthly_installment_income,
      v_monthly_subscription,
      v_total_income_current_month,
      v_previous_month_total_income,
      v_difference,
      v_previous_month_total_loan_outstanding,
      v_penalty,
      0, -- available_loan_amount
      'active', -- status
      v_period_year,
      v_period_month,
      v_period_key
    );

    v_records_created := v_records_created + 1;
  END LOOP;

  RETURN QUERY SELECT v_records_created, 
    CASE 
      WHEN v_records_created > 0 THEN 'Successfully created ' || v_records_created || ' monthly records'
      ELSE 'No records created - no users with active loans found'
    END;
END;
$$ LANGUAGE plpgsql;
