-- Fix initialize_new_month function to skip loans with orphaned user_ids
-- Version 54: Skip users that don't exist in profiles table

CREATE OR REPLACE FUNCTION public.initialize_new_month(
  p_period_key text,
  p_created_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_record RECORD;
  v_opening_balance numeric;
  v_available_loan numeric;
  v_total_principal numeric;
  v_total_interest numeric;
  v_monthly_subscription numeric;
BEGIN
  -- First, archive current month's data to history
  INSERT INTO monthly_loan_records_history
  SELECT * FROM monthly_loan_records;
  
  -- Delete current month's records
  DELETE FROM monthly_loan_records;

  -- Loop through each user with active loans and who exists in profiles
  FOR v_user_record IN
    SELECT DISTINCT 
      l.user_id,
      l.id as loan_id,
      l.interest_rate
    FROM loans l
    INNER JOIN profiles p ON l.user_id = p.id  -- Only process users that exist in profiles
    WHERE l.status = 'active'
    ORDER BY l.user_id
  LOOP
    -- Get the most recent payment data from loan_payments for this user
    SELECT 
      COALESCE(SUM(remaining_balance), 0) as total_remaining,
      COALESCE(SUM(principal_payment), 0) as total_principal,
      COALESCE(SUM(interest_payment), 0) as total_interest,
      COALESCE(SUM(monthly_subscription), 0) as total_subscription
    INTO 
      v_opening_balance,
      v_total_principal,
      v_total_interest,
      v_monthly_subscription
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
    AND loan_id = v_user_record.loan_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- If no payment history, use the loan's remaining balance
    IF v_opening_balance = 0 THEN
      SELECT remaining_balance 
      INTO v_opening_balance
      FROM loans
      WHERE id = v_user_record.loan_id;
    END IF;

    -- Calculate available loan (assuming 10x of monthly subscription)
    v_available_loan := v_monthly_subscription * 10;

    -- Insert the record for this user for the new month
    INSERT INTO monthly_loan_records (
      user_id,
      loan_id,
      period_key,
      opening_balance,
      principal_paid,
      interest_paid,
      closing_balance,
      available_loan_amount,
      monthly_subscription,
      interest_rate,
      created_by
    ) VALUES (
      v_user_record.user_id,
      v_user_record.loan_id,
      p_period_key,
      v_opening_balance,
      0,  -- No payments yet for new month
      0,  -- No interest yet for new month
      v_opening_balance,  -- Closing balance same as opening for new month
      v_available_loan,
      v_monthly_subscription,
      v_user_record.interest_rate,
      p_created_by
    );
  END LOOP;

  RAISE NOTICE 'Successfully initialized month % with data from previous period', p_period_key;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.initialize_new_month TO authenticated;
