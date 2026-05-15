-- Fix penalty calculation to only penalize ACTUALLY recorded penalties, not auto-calculated ones

DROP FUNCTION IF EXISTS public.get_user_outstanding_penalties(uuid) CASCADE;

CREATE FUNCTION public.get_user_outstanding_penalties(p_user_id uuid)
RETURNS TABLE (
  outstanding_penalty NUMERIC,
  last_payment_period TEXT,
  missed_payment_count INTEGER
) LANGUAGE plpgsql AS $$
DECLARE
  v_total_penalties NUMERIC := 0;
  v_paid_penalties NUMERIC := 0;
  v_missed_count INTEGER := 0;
  v_last_payment_period TEXT := NULL;
BEGIN
  -- Get the most recent payment period for display
  SELECT period_key
  INTO v_last_payment_period
  FROM loan_payments
  WHERE user_id = p_user_id
  ORDER BY period_year DESC, period_month DESC
  LIMIT 1;

  -- Count RECORDED penalties from penalties table — the authoritative source
  -- These are penalties explicitly recorded by admin for missed payments
  SELECT COUNT(*)::INTEGER,
         COALESCE(SUM(amount), 0)::NUMERIC
  INTO v_missed_count, v_total_penalties
  FROM penalties
  WHERE user_id = p_user_id
    AND recorded_at::date > CURRENT_DATE - INTERVAL '1 year'; -- Only recent penalties

  -- Calculate penalties already paid in loan_payments.penalty field
  SELECT COALESCE(SUM(penalty), 0)::NUMERIC
  INTO v_paid_penalties
  FROM loan_payments
  WHERE user_id = p_user_id
    AND penalty > 0;

  -- Return outstanding penalty = (recorded penalties - paid penalties), minimum 0
  RETURN QUERY SELECT 
    GREATEST(0, v_total_penalties - v_paid_penalties)::NUMERIC,
    v_last_payment_period,
    COALESCE(v_missed_count, 0)::INTEGER;
END;
$$;

-- EXPLANATION OF FIX:
-- 
-- OLD (BUGGY) BEHAVIOR:
--   Function looped through EVERY month from user's first payment to current month
--   and added ₹100 penalty for any month without a payment record.
--   This caused:
--   - New members to show penalties on day 1 (month not reached yet)
--   - Subscription-only users to show penalties even with paid subscriptions
--   - False penalty accumulation for every month gap
--
-- NEW (CORRECT) BEHAVIOR:
--   Only counts penalties EXPLICITLY RECORDED in the penalties table by admin
--   These are real, documented missed payments — not auto-calculated
--   Returns 0 for users with:
--   - No penalty records (didn't miss payments)
--   - Brand new users (joined this month)
--   - Subscription-only users (unless they have recorded penalties)
--
-- SOURCE OF TRUTH: penalties table (explicit records by admin)
-- FALLBACK: 0 penalty (user has made all scheduled payments)
