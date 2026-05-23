-- Fix initialize_new_month to use loan_payments as source of truth for balances
-- Correct logic per system design:
--   Opening Balance = latest loan_payments.remaining_balance (prev closing)
--                   + additional_loan WHERE period_key = last payment period
--                   - additional_principal WHERE period_key = last payment period
--   Closing Balance = Opening Balance - EMI paid this month (stored in loan_payments.remaining_balance)
--   total_loan_outstanding in monthly_loan_records = computed fresh, NOT carried from previous record

DROP FUNCTION IF EXISTS initialize_new_month(TEXT, UUID) CASCADE;

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
  target_year  := SUBSTRING(p_period_key, 1, 4)::INTEGER;
  target_month := SUBSTRING(p_period_key, 6, 2)::INTEGER;

  IF target_month = 1 THEN
    prev_month := 12;
    prev_year  := target_year - 1;
  ELSE
    prev_month := target_month - 1;
    prev_year  := target_year;
  END IF;

  prev_period_key := prev_year || '-' || LPAD(prev_month::TEXT, 2, '0');

  BEGIN
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
      p_period_key,
      target_month,
      target_year,
      'draft',

      -- Monthly Subscription: from prev month's payment, default 2100
      COALESCE(
        (SELECT lp.monthly_subscription
         FROM loan_payments lp
         WHERE lp.user_id = u.id AND lp.period_key = prev_period_key
         ORDER BY lp.created_at DESC LIMIT 1),
        2100
      ),

      -- total_loan_taken = Opening Balance for this period
      -- = latest loan_payments.remaining_balance (prev closing) ONLY
      -- Additional loans and principal adjustments are already reflected in the previous period's closing balance
      -- They should NOT be added again here (that would be double-counting)
      COALESCE(
        (
          SELECT lp_last.remaining_balance
          FROM loan_payments lp_last
          WHERE lp_last.user_id = u.id
          ORDER BY lp_last.period_year DESC, lp_last.period_month DESC
          LIMIT 1
        ),
        (SELECT COALESCE(SUM(l.loan_amount), 0) FROM loans l WHERE l.user_id = u.id AND l.status IN ('active', 'subscription_only'))
      ) AS total_loan_taken,

      -- Additional Principal paid IN p_period_key
      COALESCE(
        (SELECT COALESCE(SUM(lp.additional_principal), 0)
         FROM loan_payments lp
         WHERE lp.user_id = u.id AND lp.period_key = p_period_key),
        0
      ),

      -- New Loans taken IN p_period_key
      COALESCE(
        (SELECT COALESCE(SUM(al.additional_loan_amount), 0)
         FROM additional_loan al
         WHERE al.user_id = u.id AND al.period_key = p_period_key),
        0
      ),

      -- total_loan_outstanding = Closing Balance for current period
      -- If payment made this month: use loan_payments.remaining_balance for this period
      -- If no payment yet: use Opening Balance (no change in principal this month)
      COALESCE(
        (SELECT lp_curr.remaining_balance
         FROM loan_payments lp_curr
         WHERE lp_curr.user_id = u.id AND lp_curr.period_key = p_period_key
         ORDER BY lp_curr.created_at DESC LIMIT 1),
        (SELECT lp_last.remaining_balance
         FROM loan_payments lp_last
         WHERE lp_last.user_id = u.id
         ORDER BY lp_last.period_year DESC, lp_last.period_month DESC
         LIMIT 1),
        (SELECT COALESCE(SUM(l.loan_amount), 0) FROM loans l WHERE l.user_id = u.id AND l.status IN ('active', 'subscription_only'))
      ),

      -- Monthly Interest Income
      COALESCE(
        (SELECT COALESCE(SUM(lp.interest_paid), 0)
         FROM loan_payments lp WHERE lp.user_id = u.id AND lp.period_key = p_period_key),
        0
      ),

      -- Monthly Installment Income (EMI)
      COALESCE(
        (SELECT COALESCE(SUM(lp.monthly_emi), 0)
         FROM loan_payments lp WHERE lp.user_id = u.id AND lp.period_key = p_period_key),
        0
      ),

      -- Penalty
      COALESCE(
        (SELECT COALESCE(SUM(lp.penalty), 0)
         FROM loan_payments lp WHERE lp.user_id = u.id AND lp.period_key = p_period_key),
        0
      ),

      -- Previous Month Total Income (from prev month's monthly_loan_records or history)
      COALESCE(
        (SELECT mlr.total_income_current_month
         FROM monthly_loan_records mlr
         WHERE mlr.user_id = u.id AND mlr.period_month = prev_month AND mlr.period_year = prev_year
         LIMIT 1),
        (SELECT mlrh.total_income_current_month
         FROM monthly_loan_records_history mlrh
         WHERE mlrh.user_id = u.id
         ORDER BY mlrh.period_year DESC, mlrh.period_month DESC LIMIT 1),
        0
      ),

      -- Total Income Current Month = subscription + interest + emi + penalty (all from p_period_key payments)
      COALESCE(
        (SELECT lp.monthly_subscription
         FROM loan_payments lp WHERE lp.user_id = u.id AND lp.period_key = p_period_key
         ORDER BY lp.created_at DESC LIMIT 1),
        2100
      )
      + COALESCE(
        (SELECT COALESCE(SUM(lp.interest_paid), 0)
         FROM loan_payments lp WHERE lp.user_id = u.id AND lp.period_key = p_period_key),
        0
      )
      + COALESCE(
        (SELECT COALESCE(SUM(lp.monthly_emi), 0)
         FROM loan_payments lp WHERE lp.user_id = u.id AND lp.period_key = p_period_key),
        0
      )
      + COALESCE(
        (SELECT COALESCE(SUM(lp.penalty), 0)
         FROM loan_payments lp WHERE lp.user_id = u.id AND lp.period_key = p_period_key),
        0
      ),

      -- Difference = this month income - prev month income
      (
        COALESCE(
          (SELECT lp.monthly_subscription
           FROM loan_payments lp WHERE lp.user_id = u.id AND lp.period_key = p_period_key
           ORDER BY lp.created_at DESC LIMIT 1),
          2100
        )
        + COALESCE(
          (SELECT COALESCE(SUM(lp.interest_paid), 0)
           FROM loan_payments lp WHERE lp.user_id = u.id AND lp.period_key = p_period_key),
          0
        )
        + COALESCE(
          (SELECT COALESCE(SUM(lp.monthly_emi), 0)
           FROM loan_payments lp WHERE lp.user_id = u.id AND lp.period_key = p_period_key),
          0
        )
        + COALESCE(
          (SELECT COALESCE(SUM(lp.penalty), 0)
           FROM loan_payments lp WHERE lp.user_id = u.id AND lp.period_key = p_period_key),
          0
        )
      ) - COALESCE(
        (SELECT mlr.total_income_current_month
         FROM monthly_loan_records mlr
         WHERE mlr.user_id = u.id AND mlr.period_month = prev_month AND mlr.period_year = prev_year
         LIMIT 1),
        (SELECT mlrh.total_income_current_month
         FROM monthly_loan_records_history mlrh
         WHERE mlrh.user_id = u.id
         ORDER BY mlrh.period_year DESC, mlrh.period_month DESC LIMIT 1),
        0
      ),

      -- Previous Month Total Loan Outstanding
      COALESCE(
        (SELECT mlr.total_loan_outstanding
         FROM monthly_loan_records mlr
         WHERE mlr.user_id = u.id AND mlr.period_month = prev_month AND mlr.period_year = prev_year
         LIMIT 1),
        (SELECT mlrh.total_loan_outstanding
         FROM monthly_loan_records_history mlrh
         WHERE mlrh.user_id = u.id
         ORDER BY mlrh.period_year DESC, mlrh.period_month DESC LIMIT 1),
        0
      ),

      -- Available Loan Amount = 400000 - total_loan_outstanding
      400000 - COALESCE(
        (SELECT lp_curr.remaining_balance FROM loan_payments lp_curr WHERE lp_curr.user_id = u.id AND lp_curr.period_key = p_period_key ORDER BY lp_curr.created_at DESC LIMIT 1),
        (SELECT lp_last.remaining_balance FROM loan_payments lp_last WHERE lp_last.user_id = u.id ORDER BY lp_last.period_year DESC, lp_last.period_month DESC LIMIT 1),
        (SELECT COALESCE(SUM(l.loan_amount), 0) FROM loans l WHERE l.user_id = u.id AND l.status IN ('active', 'subscription_only'))
      )

    FROM profiles u
    WHERE (
      u.role IN ('member', 'user')
      OR (u.role = 'admin' AND EXISTS (
        SELECT 1 FROM loans l WHERE l.user_id = u.id AND l.status IN ('active', 'subscription_only')
      ))
    )
    AND (
      EXISTS (SELECT 1 FROM loans l WHERE l.user_id = u.id AND l.status IN ('active', 'subscription_only'))
      OR EXISTS (SELECT 1 FROM loan_payments lp WHERE lp.user_id = u.id AND lp.period_key = prev_period_key)
      OR EXISTS (
        SELECT 1 FROM monthly_loan_records mlr
        WHERE mlr.user_id = u.id AND mlr.period_month = prev_month AND mlr.period_year = prev_year
      )
      OR EXISTS (SELECT 1 FROM loan_payments lp WHERE lp.user_id = u.id AND lp.period_key = p_period_key)
    )
    AND NOT EXISTS (
      SELECT 1 FROM monthly_loan_records mlr
      WHERE mlr.user_id = u.id AND mlr.period_key = p_period_key
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
