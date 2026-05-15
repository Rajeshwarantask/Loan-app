-- Fix remaining_balance corruption caused by old logic that included additional_loan in the calculation
-- The correct formula is: remaining_balance = opening_balance - EMI (only)
-- Not: remaining_balance = opening_balance - EMI - additional_loan - additional_principal

-- This script recalculates remaining_balance for all loan_payments by:
-- 1. Finding the previous period's closing balance (or loan creation amount if first payment)
-- 2. Deducting only the monthly_emi
-- 3. NOT deducting additional_loan or additional_principal (those are tracked separately)

BEGIN;

-- Create a CTE with corrected remaining_balance values
WITH corrected_payments AS (
  SELECT 
    lp.id,
    lp.user_id,
    lp.period_key,
    lp.monthly_emi,
    l.loan_amount,
    -- Get the previous period's remaining_balance if it exists
    LAG(lp.remaining_balance) OVER (
      PARTITION BY lp.user_id 
      ORDER BY lp.period_year, lp.period_month
    ) as prev_remaining_balance,
    -- Calculate the correct remaining_balance
    COALESCE(
      LAG(lp.remaining_balance) OVER (
        PARTITION BY lp.user_id 
        ORDER BY lp.period_year, lp.period_month
      ),
      l.loan_amount::numeric
    ) - COALESCE(lp.monthly_emi, 0)::numeric as correct_remaining_balance
  FROM loan_payments lp
  JOIN loans l ON lp.loan_id::text = l.id::text
  ORDER BY lp.user_id, lp.period_year, lp.period_month
)
UPDATE loan_payments lp
SET remaining_balance = cp.correct_remaining_balance
FROM corrected_payments cp
WHERE lp.id::text = cp.id::text
  AND lp.remaining_balance::numeric != cp.correct_remaining_balance;

-- Verify the fix
SELECT 
  user_id,
  period_key,
  monthly_emi,
  remaining_balance,
  'FIXED' as status
FROM loan_payments
WHERE updated_at > now() - INTERVAL '1 minute'
ORDER BY user_id, period_year, period_month;

COMMIT;
