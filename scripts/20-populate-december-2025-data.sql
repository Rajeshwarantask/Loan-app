-- Script to populate December 2025 with actual data from the summary sheet
-- This replaces the zeros with real calculated values

-- First, update the existing December 2025 records with correct historical data
UPDATE monthly_loan_records mlr
SET
  -- Calculate total_loan_taken from ALL loans (active + completed)
  total_loan_taken = (
    SELECT COALESCE(SUM(l.amount), 0)
    FROM loans l
    WHERE l.user_id = mlr.user_id
  ),
  
  -- Calculate previous_month_principal_received from November 2025 payments
  previous_month_principal_received = (
    SELECT COALESCE(SUM(lp.principal_paid), 0)
    FROM loan_payments lp
    WHERE lp.user_id = mlr.user_id
      AND lp.month_year = '2025-11'
  ),
  
  -- Calculate previous_month_interest_income from November 2025 payments  
  previous_month_interest_income = (
    SELECT COALESCE(SUM(lp.interest_paid), 0)
    FROM loan_payments lp
    WHERE lp.user_id = mlr.user_id
      AND lp.month_year = '2025-11'
  ),
  
  -- Get previous month total outstanding from November closing
  previous_month_total_loan_outstanding = (
    SELECT COALESCE(closing_outstanding, mlr.opening_outstanding)
    FROM monthly_loan_records
    WHERE user_id = mlr.user_id
      AND month_year = '2025-11'
    LIMIT 1
  ),
  
  -- Get previous month total income from November
  previous_month_total_income = (
    SELECT COALESCE(total_monthly_income, 0)
    FROM monthly_loan_records
    WHERE user_id = mlr.user_id
      AND month_year = '2025-11'
    LIMIT 1
  ),
  
  -- Calculate monthly_installment_income from December payments
  monthly_installment_income = COALESCE(mlr.principal_paid, 0) + COALESCE(mlr.interest_paid, 0),
  
  -- Calculate available loan (4 Lakh - current outstanding)
  available_loan_amount = 400000 - COALESCE(mlr.closing_outstanding, 0),
  
  -- Calculate income difference
  income_difference = mlr.total_monthly_income - COALESCE((
    SELECT total_monthly_income
    FROM monthly_loan_records
    WHERE user_id = mlr.user_id
      AND month_year = '2025-11'
    LIMIT 1
  ), 0),
  
  updated_at = NOW()
WHERE mlr.month_year = '2025-12';

-- Create a function to refresh all calculated fields for any month
CREATE OR REPLACE FUNCTION refresh_monthly_calculated_fields(p_month_year TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_prev_month_year TEXT;
  v_year INTEGER;
  v_month INTEGER;
BEGIN
  -- Parse year and month
  v_year := CAST(SPLIT_PART(p_month_year, '-', 1) AS INTEGER);
  v_month := CAST(SPLIT_PART(p_month_year, '-', 2) AS INTEGER);
  
  -- Calculate previous month
  IF v_month = 1 THEN
    v_prev_month_year := LPAD((v_year - 1)::TEXT, 4, '0') || '-12';
  ELSE
    v_prev_month_year := LPAD(v_year::TEXT, 4, '0') || '-' || LPAD((v_month - 1)::TEXT, 2, '0');
  END IF;

  -- Update all records for the specified month
  UPDATE monthly_loan_records mlr
  SET
    -- Total loan taken = sum of ALL loan amounts ever
    total_loan_taken = (
      SELECT COALESCE(SUM(l.amount), 0)
      FROM loans l
      WHERE l.user_id = mlr.user_id
    ),
    
    -- Previous month principal = sum of principal payments from previous month
    previous_month_principal_received = (
      SELECT COALESCE(SUM(lp.principal_paid), 0)
      FROM loan_payments lp
      WHERE lp.user_id = mlr.user_id
        AND lp.month_year = v_prev_month_year
    ),
    
    -- Previous month interest = sum of interest payments from previous month
    previous_month_interest_income = (
      SELECT COALESCE(SUM(lp.interest_paid), 0)
      FROM loan_payments lp
      WHERE lp.user_id = mlr.user_id
        AND lp.month_year = v_prev_month_year
    ),
    
    -- Previous month outstanding = closing balance from previous month record
    previous_month_total_loan_outstanding = (
      SELECT COALESCE(closing_outstanding, 0)
      FROM monthly_loan_records
      WHERE user_id = mlr.user_id
        AND month_year = v_prev_month_year
      LIMIT 1
    ),
    
    -- Previous month total income from previous month record
    previous_month_total_income = (
      SELECT COALESCE(total_monthly_income, 0)
      FROM monthly_loan_records
      WHERE user_id = mlr.user_id
        AND month_year = v_prev_month_year
      LIMIT 1
    ),
    
    -- Monthly installment = principal + interest paid this month
    monthly_installment_income = COALESCE(mlr.principal_paid, 0) + COALESCE(mlr.interest_paid, 0),
    
    -- Available loan = 4 Lakh - current outstanding
    available_loan_amount = 400000 - COALESCE(mlr.closing_outstanding, 0),
    
    -- Income difference = current income - previous income
    income_difference = mlr.total_monthly_income - COALESCE((
      SELECT total_monthly_income
      FROM monthly_loan_records
      WHERE user_id = mlr.user_id
        AND month_year = v_prev_month_year
      LIMIT 1
    ), 0),
    
    updated_at = NOW()
  WHERE mlr.month_year = p_month_year;
  
  RAISE NOTICE 'Refreshed calculated fields for %', p_month_year;
END;
$$;

-- Run the refresh for December 2025
SELECT refresh_monthly_calculated_fields('2025-12');

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'December 2025 data populated successfully with actual calculated values';
  RAISE NOTICE 'Created refresh_monthly_calculated_fields() function for future use';
END $$;
