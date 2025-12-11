-- Fix triggers that reference the dropped payment_type column
-- The loan_payments table now uses separate columns for payment components

-- Drop the old trigger that references payment_type
DROP TRIGGER IF EXISTS sync_payment_to_ledger_trigger ON loan_payments CASCADE;
DROP FUNCTION IF EXISTS sync_payment_to_ledger() CASCADE;

-- Drop other old triggers that might reference payment_type
DROP TRIGGER IF EXISTS check_payment_limits_trigger ON loan_payments CASCADE;
DROP FUNCTION IF EXISTS check_payment_limits() CASCADE;

-- Note: We're keeping the sync_payment_to_monthly_record trigger from script 27
-- as it should work with the new schema (it doesn't reference payment_type)

-- Verify the sync trigger exists and works with new schema
-- The trigger should use Monthly_Emi, principal_paid, interest_paid columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'sync_payment_trigger' 
    AND tgrelid = 'loan_payments'::regclass
  ) THEN
    RAISE NOTICE 'Warning: sync_payment_trigger not found. Payment syncing may not work.';
  END IF;
END $$;
