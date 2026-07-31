-- Fix initialize_new_month RPC function signature and add proper validation
-- Match the frontend parameters: p_period_key and p_created_by

-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS initialize_new_month(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS initialize_new_month(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS initialize_new_month(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION initialize_new_month(p_period_key TEXT, p_created_by UUID DEFAULT NULL)
RETURNS json AS $$
DECLARE
  target_month INTEGER;
  target_year INTEGER;
  prev_month INTEGER;
  prev_year INTEGER;
  prev_period_key TEXT;
  records_created INTEGER := 0;
  v_error_msg TEXT;
BEGIN
  -- Parse period_key (format: YYYY-MM)
  target_year := SUBSTRING(p_period_key, 1, 4)::INTEGER;
  target_month := SUBSTRING(p_period_key, 6, 2)::INTEGER;
  
  -- Calculate previous month/year
  IF target_month = 1 THEN
    prev_month := 12;
    prev_year := target_year - 1;
  ELSE
    prev_month := target_month - 1;
    prev_year := target_year;
  END IF;
  
  prev_period_key := prev_year || '-' || LPAD(prev_month::TEXT, 2, '0');
  
  BEGIN
    -- Insert records for valid users with profiles
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
      available_loan_amount
    )
    SELECT 
      u.id AS user_id,
      u.member_id,
      p_period_key AS period_key,
      target_month AS period_month,
      target_year AS period_year,
      'draft' AS status,
      COALESCE(
        (SELECT lp.monthly_subscription
         FROM loan_payments lp
         WHERE lp.user_id = u.id
           AND lp.period_key = prev_period_key
         ORDER BY lp.created_at DESC
         LIMIT 1),
        2100
      ) AS monthly_subscription,
      
      -- Opening Balance
      COALESCE(
    (
        SELECT lp.opening_balance
        FROM loan_payments lp
        WHERE lp.user_id = u.id
          AND lp.period_key = p_period_key
        ORDER BY lp.created_at DESC
        LIMIT 1
    ),
    (
        SELECT mlr.total_loan_outstanding
        FROM monthly_loan_records mlr
        WHERE mlr.user_id = u.id
          AND mlr.period_month = prev_month
          AND mlr.period_year = prev_year
        LIMIT 1
    ),
    (
        SELECT mlrh.total_loan_outstanding
        FROM monthly_loan_records_history mlrh
        WHERE mlrh.user_id = u.id
        ORDER BY mlrh.period_year DESC, mlrh.period_month DESC
        LIMIT 1
    ),
    (
        SELECT COALESCE(SUM(l.loan_amount),0)
        FROM loans l
        WHERE l.user_id=u.id
          AND l.status='active'
        )
    ) AS total_loan_taken,
      
      -- Additional Principal from loan_payments
      COALESCE(
        (SELECT COALESCE(SUM(lp.additional_principal), 0)
         FROM loan_payments lp
         WHERE lp.user_id = u.id
           AND lp.period_key = p_period_key),
        0
      ) AS additional_principal,
      
      -- New Loans Issued
      COALESCE(
        (SELECT COALESCE(SUM(al.additional_loan_amount), 0)
         FROM additional_loan al
         WHERE al.user_id = u.id
           AND al.period_key = p_period_key),
        0
      ) AS new_loan_taken,
      
      -- Total Loan Outstanding
      -- Total Loan Outstanding (Closing Balance)
COALESCE(
  -- Primary source: current month's payment closing balance
  (
    SELECT lp.remaining_balance
    FROM loan_payments lp
    WHERE lp.user_id = u.id
      AND lp.period_key = p_period_key
    ORDER BY lp.created_at DESC
    LIMIT 1
  ),

  -- Fallback 1: previous monthly record closing balance + current month changes
  (
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
       WHERE l.user_id = u.id 
         AND l.status = 'active')
    )
    +
    COALESCE(
      (SELECT SUM(al.additional_loan_amount)
       FROM additional_loan al
       WHERE al.user_id = u.id
         AND al.period_key = p_period_key),
      0
    )
    -
    COALESCE(
      (SELECT SUM(lp.additional_principal)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = p_period_key),
      0
    )
    -
    COALESCE(
      (SELECT SUM(lp.monthly_emi)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = p_period_key),
      0
    )
  ),

  0
) AS total_loan_outstanding,
      
      -- Monthly Interest Income
      COALESCE(
        (SELECT COALESCE(SUM(lp.interest_paid), 0)
         FROM loan_payments lp
         WHERE lp.user_id = u.id
           AND lp.period_key = p_period_key),
        0
      ) AS monthly_interest_income,
      
      -- Monthly Installment Income
      COALESCE(
        (SELECT COALESCE(SUM(lp.monthly_emi), 0)
         FROM loan_payments lp
         WHERE lp.user_id = u.id
           AND lp.period_key = p_period_key),
        0
      ) AS monthly_installment_income,
      
      -- Penalty
      COALESCE(
        (SELECT COALESCE(SUM(lp.penalty), 0)
         FROM loan_payments lp
         WHERE lp.user_id = u.id
           AND lp.period_key = p_period_key),
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
      
      -- Total Income Current Month
      COALESCE(
        (SELECT lp.monthly_subscription
         FROM loan_payments lp
         WHERE lp.user_id = u.id AND lp.period_key = prev_period_key
         ORDER BY lp.created_at DESC LIMIT 1), 2100
      ) + 
      COALESCE(
        (SELECT COALESCE(SUM(lp.interest_paid), 0)
         FROM loan_payments lp
         WHERE lp.user_id = u.id
           AND lp.period_key = p_period_key),
        0
      ) +
      COALESCE(
        (SELECT COALESCE(SUM(lp.monthly_emi), 0)
         FROM loan_payments lp
         WHERE lp.user_id = u.id
           AND lp.period_key = p_period_key),
        0
      ) +
      COALESCE(
        (SELECT COALESCE(SUM(lp.penalty), 0)
         FROM loan_payments lp
         WHERE lp.user_id = u.id
           AND lp.period_key = p_period_key),
        0
      ) AS total_income_current_month,
      
      -- Difference
      (COALESCE(
        (SELECT lp.monthly_subscription
         FROM loan_payments lp
         WHERE lp.user_id = u.id AND lp.period_key = prev_period_key
         ORDER BY lp.created_at DESC LIMIT 1), 2100
      ) + 
      COALESCE(
        (SELECT COALESCE(SUM(lp.interest_paid), 0)
         FROM loan_payments lp
         WHERE lp.user_id = u.id
           AND lp.period_key = p_period_key),
        0
      ) +
      COALESCE(
        (SELECT COALESCE(SUM(lp.monthly_emi), 0)
         FROM loan_payments lp
         WHERE lp.user_id = u.id
           AND lp.period_key = p_period_key),
        0
      ) +
      COALESCE(
        (SELECT COALESCE(SUM(lp.penalty), 0)
         FROM loan_payments lp
         WHERE lp.user_id = u.id
           AND lp.period_key = p_period_key),
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
      
    -- Available Loan Amount
400000 - COALESCE(
  (
    SELECT lp.remaining_balance
    FROM loan_payments lp
    WHERE lp.user_id = u.id
      AND lp.period_key = p_period_key
    ORDER BY lp.created_at DESC
    LIMIT 1
  ),

  -- fallback calculation
  (
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

      (SELECT COALESCE(SUM(l.loan_amount),0)
       FROM loans l
       WHERE l.user_id = u.id
         AND l.status='active')
    )
    +
    COALESCE(
      (SELECT SUM(al.additional_loan_amount)
       FROM additional_loan al
       WHERE al.user_id = u.id
         AND al.period_key = p_period_key),
      0
    )
    -
    COALESCE(
      (SELECT SUM(lp.additional_principal)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = p_period_key),
      0
    )
    -
    COALESCE(
      (SELECT SUM(lp.monthly_emi)
       FROM loan_payments lp
       WHERE lp.user_id = u.id
         AND lp.period_key = p_period_key),
      0
    )
  ),
  0
) AS available_loan_amount

    FROM profiles u
    WHERE (u.role = 'member' OR u.role = 'user'
      OR (
        -- Include admins who have active loans
        u.role = 'admin' AND EXISTS (
          SELECT 1 FROM loans l 
          WHERE l.user_id = u.id 
          AND l.status = 'active'
        )
      )
    )
      AND (
        -- Users with active loans
        EXISTS (
          SELECT 1 FROM loans l 
          WHERE l.user_id = u.id 
          AND l.status = 'active'
        )
        OR
        -- Users who have made payments in previous month (subscription-only)
        EXISTS (
          SELECT 1 FROM loan_payments lp
          WHERE lp.user_id = u.id
            AND lp.period_key = prev_period_key
        )
        OR
        -- Users who were in previous month's records
        EXISTS (
          SELECT 1 FROM monthly_loan_records mlr
          WHERE mlr.user_id = u.id
            AND mlr.period_month = prev_month
            AND mlr.period_year = prev_year
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM monthly_loan_records mlr
        WHERE mlr.user_id = u.id
          AND mlr.period_key = p_period_key
      );
    
    GET DIAGNOSTICS records_created = ROW_COUNT;
    
    RETURN json_build_object(
      'success', true,
      'records_created', records_created,
      'period_key', p_period_key,
      'message', 'Month initialized successfully'
    );
    
  EXCEPTION WHEN OTHERS THEN
    v_error_msg := SQLERRM;
    RETURN json_build_object(
      'success', false,
      'error', v_error_msg,
      'records_created', 0
    );
  END;

END;
$$ LANGUAGE plpgsql;
