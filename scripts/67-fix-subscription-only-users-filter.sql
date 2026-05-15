-- Fix subscription-only users filter
-- Only show users who have:
-- 1. Active loans, OR
-- 2. Have paid their subscription (exists in loan_payments with payment)
-- Do NOT show subscription-only users who haven't paid yet

CREATE OR REPLACE FUNCTION initialize_new_month(target_month INTEGER, target_year INTEGER)
RETURNS VOID AS $$
DECLARE
  period_key_value TEXT;
  prev_month INTEGER;
  prev_year INTEGER;
BEGIN
  -- Generate period_key
  period_key_value := target_year || '-' || LPAD(target_month::TEXT, 2, '0');
  
  -- Calculate previous month
  IF target_month = 1 THEN
    prev_month := 12;
    prev_year := target_year - 1;
  ELSE
    prev_month := target_month - 1;
    prev_year := target_year;
  END IF;

  -- Insert records for all users with active loans or who have paid subscriptions
  INSERT INTO monthly_loan_records (
    user_id,
    member_id,
    period_key,
    period_month,
    period_year,
    status,
    monthly_subscription,
    total_loan_taken,
    additional_principal,
    new_loan_taken,
    total_loan_outstanding,
    monthly_interest_income,
    monthly_installment_income,
    penalty,
    previous_month_total_income,
    total_income_current_month,
    difference,
    previous_month_total_loan_outstanding,
    available_loan_amount
  )
  SELECT 
    u.id AS user_id,
    u.member_id,
    period_key_value AS period_key,
    target_month AS period_month,
    target_year AS period_year,
    'draft' AS status,
    200 AS monthly_subscription, -- Fixed subscription amount
    
    -- Opening Balance (total_loan_taken): 
    -- 1. Try to get previous month's closing balance
    -- 2. If not found, try to get most recent closing balance from history
    -- 3. If still not found, use original loan amount from loans table
    COALESCE(
      (SELECT mlr.total_loan_outstanding 
       FROM monthly_loan_records mlr 
       WHERE mlr.user_id = u.id 
         AND mlr.period_month = prev_month 
         AND mlr.period_year = prev_year
       LIMIT 1),
      (SELECT mlrh.total_loan_outstanding
       FROM monthly_loan_records_history mlrh
       WHERE mlrh.user_id = u.id
       ORDER BY mlrh.period_year DESC, mlrh.period_month DESC
       LIMIT 1),
      (SELECT COALESCE(SUM(l.loan_amount), 0)
       FROM loans l
       WHERE l.user_id = u.id)
    ) AS total_loan_taken,
    
    -- Additional Principal from loan_payments for current period
    COALESCE(
      (SELECT COALESCE(SUM(lp.additional_principal), 0)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = period_key_value),
      0
    ) AS additional_principal,
    
    -- New Loans Issued from additional_loan table for current period
    COALESCE(
      (SELECT COALESCE(SUM(al.additional_loan_amount), 0)
       FROM additional_loan al
       WHERE al.user_id = u.id
         AND al.period_key = period_key_value),
      0
    ) AS new_loan_taken,
    
    -- Total Loan Outstanding = Opening Balance + New Loans - Additional Principal - Monthly Installment
    COALESCE(
      (SELECT mlr.total_loan_outstanding 
       FROM monthly_loan_records mlr 
       WHERE mlr.user_id = u.id 
         AND mlr.period_month = prev_month 
         AND mlr.period_year = prev_year
       LIMIT 1),
      (SELECT mlrh.total_loan_outstanding
       FROM monthly_loan_records_history mlrh
       WHERE mlrh.user_id = u.id
       ORDER BY mlrh.period_year DESC, mlrh.period_month DESC
       LIMIT 1),
      (SELECT COALESCE(SUM(l.loan_amount), 0)
       FROM loans l
       WHERE l.user_id = u.id)
    ) 
    + COALESCE(
      (SELECT COALESCE(SUM(al.additional_loan_amount), 0)
       FROM additional_loan al
       WHERE al.user_id = u.id
         AND al.period_key = period_key_value),
      0
    )
    - COALESCE(
      (SELECT COALESCE(SUM(lp.additional_principal), 0)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = period_key_value),
      0
    )
    - COALESCE(
      (SELECT COALESCE(SUM(lp.monthly_emi), 0)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = period_key_value),
      0
    ) AS total_loan_outstanding,
    
    -- Monthly Interest Income from loan_payments
    COALESCE(
      (SELECT COALESCE(SUM(lp.interest_paid), 0)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = period_key_value),
      0
    ) AS monthly_interest_income,
    
    -- Monthly Installment Income (EMI) from loan_payments
    COALESCE(
      (SELECT COALESCE(SUM(lp.monthly_emi), 0)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = period_key_value),
      0
    ) AS monthly_installment_income,
    
    -- Penalty from loan_payments
    COALESCE(
      (SELECT COALESCE(SUM(lp.penalty), 0)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = period_key_value),
      0
    ) AS penalty,
    
    -- Previous Month Total Income
    COALESCE(
      (SELECT mlr.total_income_current_month
       FROM monthly_loan_records mlr
       WHERE mlr.user_id = u.id
         AND mlr.period_month = prev_month
         AND mlr.period_year = prev_year
       LIMIT 1),
      (SELECT mlrh.total_income_current_month
       FROM monthly_loan_records_history mlrh
       WHERE mlrh.user_id = u.id
       ORDER BY mlrh.period_year DESC, mlrh.period_month DESC
       LIMIT 1),
      0
    ) AS previous_month_total_income,
    
    -- Total Income Current Month = Subscription + Interest + Installment + Penalty
    200 + 
    COALESCE(
      (SELECT COALESCE(SUM(lp.interest_paid), 0)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = period_key_value),
      0
    ) +
    COALESCE(
      (SELECT COALESCE(SUM(lp.monthly_emi), 0)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = period_key_value),
      0
    ) +
    COALESCE(
      (SELECT COALESCE(SUM(lp.penalty), 0)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = period_key_value),
      0
    ) AS total_income_current_month,
    
    -- Difference = Current Month Income - Previous Month Income
    (200 + 
    COALESCE(
      (SELECT COALESCE(SUM(lp.interest_paid), 0)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = period_key_value),
      0
    ) +
    COALESCE(
      (SELECT COALESCE(SUM(lp.monthly_emi), 0)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = period_key_value),
      0
    ) +
    COALESCE(
      (SELECT COALESCE(SUM(lp.penalty), 0)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = period_key_value),
      0
    )) -
    COALESCE(
      (SELECT mlr.total_income_current_month
       FROM monthly_loan_records mlr
       WHERE mlr.user_id = u.id
         AND mlr.period_month = prev_month
         AND mlr.period_year = prev_year
       LIMIT 1),
      (SELECT mlrh.total_income_current_month
       FROM monthly_loan_records_history mlrh
       WHERE mlrh.user_id = u.id
       ORDER BY mlrh.period_year DESC, mlrh.period_month DESC
       LIMIT 1),
      0
    ) AS difference,
    
    -- Previous Month Total Loan Outstanding
    COALESCE(
      (SELECT mlr.total_loan_outstanding
       FROM monthly_loan_records mlr
       WHERE mlr.user_id = u.id
         AND mlr.period_month = prev_month
         AND mlr.period_year = prev_year
       LIMIT 1),
      (SELECT mlrh.total_loan_outstanding
       FROM monthly_loan_records_history mlrh
       WHERE mlrh.user_id = u.id
       ORDER BY mlrh.period_year DESC, mlrh.period_month DESC
       LIMIT 1),
      0
    ) AS previous_month_total_loan_outstanding,
    
    -- Available Loan Amount = 400000 - Current Total Loan Outstanding
    400000 - (
      COALESCE(
        (SELECT mlr.total_loan_outstanding 
         FROM monthly_loan_records mlr 
         WHERE mlr.user_id = u.id 
           AND mlr.period_month = prev_month 
           AND mlr.period_year = prev_year
         LIMIT 1),
        (SELECT mlrh.total_loan_outstanding
         FROM monthly_loan_records_history mlrh
         WHERE mlrh.user_id = u.id
         ORDER BY mlrh.period_year DESC, mlrh.period_month DESC
         LIMIT 1),
        (SELECT COALESCE(SUM(l.loan_amount), 0)
         FROM loans l
         WHERE l.user_id = u.id)
      ) 
      + COALESCE(
        (SELECT COALESCE(SUM(al.additional_loan_amount), 0)
         FROM additional_loan al
         WHERE al.user_id = u.id
           AND al.period_key = period_key_value),
        0
      )
      - COALESCE(
        (SELECT COALESCE(SUM(lp.additional_principal), 0)
         FROM loan_payments lp
         WHERE lp.user_id = u.id
           AND lp.period_key = period_key_value),
        0
      )
      - COALESCE(
        (SELECT COALESCE(SUM(lp.monthly_emi), 0)
         FROM loan_payments lp
         WHERE lp.user_id = u.id
           AND lp.period_key = period_key_value),
        0
      )
    ) AS available_loan_amount

  FROM profiles u
  WHERE u.role = 'user'
    AND (
      -- Users with active loans
      EXISTS (
        SELECT 1 FROM loans l 
        WHERE l.user_id = u.id 
        AND l.status = 'active'
      )
      OR
      -- Users who have paid subscription (exists in loan_payments with status='paid')
      EXISTS (
        SELECT 1 FROM loan_payments lp
        WHERE lp.user_id = u.id
          AND lp.period_key = period_key_value
          AND lp.status = 'paid'
          AND lp.monthly_subscription > 0
      )
      OR
      -- Users who were in previous month's records (recurring members)
      EXISTS (
        SELECT 1 FROM monthly_loan_records mlr
        WHERE mlr.user_id = u.id
          AND mlr.period_month = prev_month
          AND mlr.period_year = prev_year
      )
    )
    -- Avoid duplicates
    AND NOT EXISTS (
      SELECT 1 FROM monthly_loan_records mlr
      WHERE mlr.user_id = u.id
        AND mlr.period_key = period_key_value
    );

END;
$$ LANGUAGE plpgsql;
