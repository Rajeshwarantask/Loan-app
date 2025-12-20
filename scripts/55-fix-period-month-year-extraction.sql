-- Fix initialize_new_month to properly extract period_month and period_year as integers
-- Version 55: Parse period_key to extract month and year integers

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
  v_period_year integer;
  v_period_month integer;
BEGIN
  -- Extract year and month from period_key (format: "YYYY-MM")
  v_period_year := CAST(split_part(p_period_key, '-', 1) AS integer);
  v_period_month := CAST(split_part(p_period_key, '-', 2) AS integer);

  -- First, archive current month's data to history
  INSERT INTO monthly_loan_records_history
  SELECT *, NOW() as archived_at FROM monthly_loan_records;
  
  -- Delete current month's records
  DELETE FROM monthly_loan_records;

  -- Loop through each user with active loans and who exists in profiles
  FOR v_user_record IN
    SELECT DISTINCT 
      l.user_id,
      l.id as loan_id,
      l.interest_rate,
      p.member_id
    FROM loans l
    INNER JOIN profiles p ON l.user_id = p.id
    WHERE l.status = 'active'
    ORDER BY l.user_id
  LOOP
    -- Get the most recent payment data from loan_payments for this user
    SELECT 
      COALESCE(remaining_balance, 0) as remaining,
      COALESCE(monthly_subscription, 0) as subscription
    INTO 
      v_opening_balance,
      v_monthly_subscription
    FROM loan_payments
    WHERE user_id = v_user_record.user_id
    AND loan_id = v_user_record.loan_id::text
    ORDER BY created_at DESC
    LIMIT 1;

    -- If no payment history, use the loan's remaining balance
    IF v_opening_balance = 0 THEN
      SELECT 
        COALESCE(remaining_balance, 0),
        COALESCE(monthly_subscription, 0)
      INTO 
        v_opening_balance,
        v_monthly_subscription
      FROM loans
      WHERE id = v_user_record.loan_id;
    END IF;

    -- Calculate available loan (10x monthly subscription)
    v_available_loan := v_monthly_subscription * 10;

    -- Insert the record for this user for the new month
    INSERT INTO monthly_loan_records (
      user_id,
      member_id,
      period_key,
      period_year,
      period_month,
      total_loan_outstanding,
      total_loan_taken,
      available_loan_amount,
      monthly_subscription,
      status
    ) VALUES (
      v_user_record.user_id,
      v_user_record.member_id,
      p_period_key,
      v_period_year,
      v_period_month,
      v_opening_balance,
      v_opening_balance,
      v_available_loan,
      v_monthly_subscription,
      'pending'
    );
  END LOOP;

  RAISE NOTICE 'Successfully initialized month % with data from previous period', p_period_key;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.initialize_new_month TO authenticated;
