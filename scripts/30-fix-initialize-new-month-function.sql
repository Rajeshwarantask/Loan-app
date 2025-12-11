-- Fix initialize_new_month function to calculate values correctly
-- This function was broken because it referenced profiles.monthly_subscription which was dropped

-- Drop all versions of the function using CASCADE
DROP FUNCTION IF EXISTS initialize_new_month CASCADE;

CREATE OR REPLACE FUNCTION initialize_new_month(target_month INTEGER, target_year INTEGER)
RETURNS TABLE(
  user_id UUID,
  member_id TEXT,
  full_name TEXT,
  period_key TEXT,
  records_created INTEGER
) AS $$
DECLARE
  v_period_key TEXT;
  v_records_created INTEGER := 0;
BEGIN
  -- Generate period_key
  v_period_key := target_year || '-' || LPAD(target_month::TEXT, 2, '0');
  
  -- Delete existing records for this period (if re-initializing)
  DELETE FROM monthly_loan_records WHERE month_year = v_period_key;
  
  -- Insert records for all users with loans
  INSERT INTO monthly_loan_records (
    user_id,
    member_id,
    month_year,
    monthly_subscription,
    total_loan_taken,
    opening_outstanding,
    principal_received_last_month,
    new_loans_last_month,
    closing_outstanding,
    monthly_interest_income,
    monthly_installment_income,
    penalty_income,
    previous_interest_income,
    total_income_current_month,
    previous_total_income,
    income_difference,
    previous_outstanding,
    available_loan_amount,
    status
  )
  SELECT 
    p.id as user_id,
    p.member_id,
    v_period_key as month_year,
    
    -- Monthly subscription (set to 0 since column doesn't exist in profiles anymore, will be updated via bulk settings)
    0 as monthly_subscription,
    
    -- Total loan taken (sum of all loans ever issued to this user)
    COALESCE((
      SELECT SUM(l.amount)
      FROM loans l
      WHERE l.user_id = p.id
    ), 0) as total_loan_taken,
    
    -- Opening outstanding (sum of principal_remaining for all active loans)
    COALESCE((
      SELECT SUM(l.principal_remaining)
      FROM loans l
      WHERE l.user_id = p.id AND l.status = 'active'
    ), 0) as opening_outstanding,
    
    -- Principal received last month (sum of principal_paid from last month's payments)
    COALESCE((
      SELECT SUM(lp.principal_paid)
      FROM loan_payments lp
      WHERE lp.user_id = p.id
        AND EXTRACT(MONTH FROM lp.payment_date) = target_month
        AND EXTRACT(YEAR FROM lp.payment_date) = target_year
    ), 0) as principal_received_last_month,
    
    -- New loans issued last month (sum of loans disbursed in the target month)
    COALESCE((
      SELECT SUM(l.amount)
      FROM loans l
      WHERE l.user_id = p.id
        AND EXTRACT(MONTH FROM l.disbursement_date) = target_month
        AND EXTRACT(YEAR FROM l.disbursement_date) = target_year
    ), 0) as new_loans_last_month,
    
    -- Closing outstanding (opening - principal_received + new_loans)
    COALESCE((
      SELECT SUM(l.principal_remaining)
      FROM loans l
      WHERE l.user_id = p.id AND l.status = 'active'
    ), 0) as closing_outstanding,
    
    -- Monthly interest income (sum of interest_paid from this month)
    COALESCE((
      SELECT SUM(lp.interest_paid)
      FROM loan_payments lp
      WHERE lp.user_id = p.id
        AND EXTRACT(MONTH FROM lp.payment_date) = target_month
        AND EXTRACT(YEAR FROM lp.payment_date) = target_year
    ), 0) as monthly_interest_income,
    
    -- Monthly installment income (sum of principal_paid from this month)
    COALESCE((
      SELECT SUM(lp.principal_paid)
      FROM loan_payments lp
      WHERE lp.user_id = p.id
        AND EXTRACT(MONTH FROM lp.payment_date) = target_month
        AND EXTRACT(YEAR FROM lp.payment_date) = target_year
    ), 0) as monthly_installment_income,
    
    -- Penalty income (will be updated separately when penalties are applied)
    0 as penalty_income,
    
    -- Previous month's interest income (get from previous month's record)
    COALESCE((
      SELECT mlr.monthly_interest_income
      FROM monthly_loan_records mlr
      WHERE mlr.user_id = p.id
        AND mlr.month_year = (
          CASE 
            WHEN target_month = 1 THEN (target_year - 1) || '-12'
            ELSE target_year || '-' || LPAD((target_month - 1)::TEXT, 2, '0')
          END
        )
    ), 0) as previous_interest_income,
    
    -- Total income current month (interest + installment + penalty)
    COALESCE((
      SELECT SUM(lp.interest_paid) + SUM(lp.principal_paid)
      FROM loan_payments lp
      WHERE lp.user_id = p.id
        AND EXTRACT(MONTH FROM lp.payment_date) = target_month
        AND EXTRACT(YEAR FROM lp.payment_date) = target_year
    ), 0) as total_income_current_month,
    
    -- Previous month's total income
    COALESCE((
      SELECT mlr.total_income_current_month
      FROM monthly_loan_records mlr
      WHERE mlr.user_id = p.id
        AND mlr.month_year = (
          CASE 
            WHEN target_month = 1 THEN (target_year - 1) || '-12'
            ELSE target_year || '-' || LPAD((target_month - 1)::TEXT, 2, '0')
          END
        )
    ), 0) as previous_total_income,
    
    -- Income difference
    COALESCE((
      SELECT SUM(lp.interest_paid) + SUM(lp.principal_paid)
      FROM loan_payments lp
      WHERE lp.user_id = p.id
        AND EXTRACT(MONTH FROM lp.payment_date) = target_month
        AND EXTRACT(YEAR FROM lp.payment_date) = target_year
    ), 0) - COALESCE((
      SELECT mlr.total_income_current_month
      FROM monthly_loan_records mlr
      WHERE mlr.user_id = p.id
        AND mlr.month_year = (
          CASE 
            WHEN target_month = 1 THEN (target_year - 1) || '-12'
            ELSE target_year || '-' || LPAD((target_month - 1)::TEXT, 2, '0')
          END
        )
    ), 0) as income_difference,
    
    -- Previous month's outstanding
    COALESCE((
      SELECT mlr.closing_outstanding
      FROM monthly_loan_records mlr
      WHERE mlr.user_id = p.id
        AND mlr.month_year = (
          CASE 
            WHEN target_month = 1 THEN (target_year - 1) || '-12'
            ELSE target_year || '-' || LPAD((target_month - 1)::TEXT, 2, '0')
          END
        )
    ), 0) as previous_outstanding,
    
    -- Available loan (set to 0, will be updated via bulk settings)
    0 as available_loan_amount,
    
    -- Status
    'active' as status
    
  FROM profiles p
  WHERE EXISTS (
    SELECT 1 FROM loans l WHERE l.user_id = p.id
  );
  
  GET DIAGNOSTICS v_records_created = ROW_COUNT;
  
  -- Return summary
  RETURN QUERY
  SELECT 
    p.id,
    p.member_id,
    p.full_name,
    v_period_key,
    v_records_created
  FROM profiles p
  WHERE EXISTS (
    SELECT 1 FROM loans l WHERE l.user_id = p.id
  );
  
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION initialize_new_month(INTEGER, INTEGER) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION initialize_new_month IS 'Initializes monthly loan records for all users with loans, calculating all financial values from actual loan and payment data';
