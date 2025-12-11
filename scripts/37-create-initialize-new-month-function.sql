-- Create initialize_new_month function for the redesigned schema
-- This function creates monthly loan records for all users with active loans

DROP FUNCTION IF EXISTS initialize_new_month(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS initialize_new_month(INTEGER, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION initialize_new_month(
  p_month_year TEXT,
  p_created_by UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_year INTEGER;
  v_period_month INTEGER;
  v_period_key TEXT;
  v_records_created INTEGER := 0;
  v_user_record RECORD;
BEGIN
  -- Parse the month_year string (format: YYYY-MM)
  v_period_year := CAST(SPLIT_PART(p_month_year, '-', 1) AS INTEGER);
  v_period_month := CAST(SPLIT_PART(p_month_year, '-', 2) AS INTEGER);
  v_period_key := p_month_year;

  -- Check if records already exist for this period
  IF EXISTS (
    SELECT 1 FROM monthly_loan_records 
    WHERE period_key = v_period_key
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Records already exist for this period',
      'records_created', 0
    );
  END IF;

  -- Insert records for each user with active loans
  FOR v_user_record IN (
    SELECT DISTINCT
      l.user_id,
      l.member_id,
      p.full_name
    FROM loans l
    INNER JOIN profiles p ON l.user_id = p.id
    WHERE l.status = 'active'
      -- Removed role='member' filter to include all users with active loans
  )
  LOOP
    -- Calculate aggregated values for this user
    INSERT INTO monthly_loan_records (
      user_id,
      member_id,
      period_year,
      period_month,
      period_key,
      total_loan_taken,
      previous_month_principal_received,
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
      created_at,
      updated_at
    )
    SELECT
      v_user_record.user_id,
      v_user_record.member_id,
      v_period_year,
      v_period_month,
      v_period_key,
      -- total_loan_taken: sum of all loan amounts for this user
      COALESCE((
        SELECT SUM(loan_amount) 
        FROM loans 
        WHERE user_id = v_user_record.user_id
      ), 0),
      -- previous_month_principal_received: from previous month's additional principal payments
      COALESCE((
        SELECT SUM(additional_principal) 
        FROM loan_payments 
        WHERE user_id = v_user_record.user_id
          AND period_year = CASE WHEN v_period_month = 1 THEN v_period_year - 1 ELSE v_period_year END
          AND period_month = CASE WHEN v_period_month = 1 THEN 12 ELSE v_period_month - 1 END
      ), 0),
      -- monthly_interest_income: from current month's payments
      COALESCE((
        SELECT SUM(interest_paid) 
        FROM loan_payments 
        WHERE user_id = v_user_record.user_id
          AND period_year = v_period_year
          AND period_month = v_period_month
      ), 0),
      -- new_loan_taken: loans created in current month
      COALESCE((
        SELECT SUM(loan_amount) 
        FROM loans 
        WHERE user_id = v_user_record.user_id
          AND EXTRACT(YEAR FROM created_at) = v_period_year
          AND EXTRACT(MONTH FROM created_at) = v_period_month
      ), 0),
      -- total_loan_outstanding: sum of remaining balances
      COALESCE((
        SELECT SUM(remaining_balance) 
        FROM loans 
        WHERE user_id = v_user_record.user_id
          AND status = 'active'
      ), 0),
      -- monthly_installment_income: sum of monthly EMI payments
      COALESCE((
        SELECT SUM(monthly_emi) 
        FROM loan_payments 
        WHERE user_id = v_user_record.user_id
          AND period_year = v_period_year
          AND period_month = v_period_month
      ), 0),
      -- monthly_subscription: default 0, can be updated later
      0,
      -- total_income_current_month: interest + EMI
      COALESCE((
        SELECT SUM(interest_paid) + SUM(monthly_emi)
        FROM loan_payments 
        WHERE user_id = v_user_record.user_id
          AND period_year = v_period_year
          AND period_month = v_period_month
      ), 0),
      -- previous_month_total_income
      COALESCE((
        SELECT total_income_current_month
        FROM monthly_loan_records
        WHERE user_id = v_user_record.user_id
          AND period_year = CASE WHEN v_period_month = 1 THEN v_period_year - 1 ELSE v_period_year END
          AND period_month = CASE WHEN v_period_month = 1 THEN 12 ELSE v_period_month - 1 END
      ), 0),
      -- difference: current month income - previous month income
      COALESCE((
        SELECT SUM(interest_paid) + SUM(monthly_emi)
        FROM loan_payments 
        WHERE user_id = v_user_record.user_id
          AND period_year = v_period_year
          AND period_month = v_period_month
      ), 0) - COALESCE((
        SELECT total_income_current_month
        FROM monthly_loan_records
        WHERE user_id = v_user_record.user_id
          AND period_year = CASE WHEN v_period_month = 1 THEN v_period_year - 1 ELSE v_period_year END
          AND period_month = CASE WHEN v_period_month = 1 THEN 12 ELSE v_period_month - 1 END
      ), 0),
      -- previous_month_total_loan_outstanding
      COALESCE((
        SELECT total_loan_outstanding
        FROM monthly_loan_records
        WHERE user_id = v_user_record.user_id
          AND period_year = CASE WHEN v_period_month = 1 THEN v_period_year - 1 ELSE v_period_year END
          AND period_month = CASE WHEN v_period_month = 1 THEN 12 ELSE v_period_month - 1 END
      ), 0),
      -- penalty: default 0
      0,
      -- available_loan_amount: default 0, can be updated later
      0,
      -- status
      'active',
      NOW(),
      NOW();

    v_records_created := v_records_created + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Monthly records initialized successfully',
    'records_created', v_records_created
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', SQLERRM,
      'records_created', 0
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION initialize_new_month(TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION initialize_new_month IS 'Initializes monthly loan records for all users with active loans based on the redesigned schema';
