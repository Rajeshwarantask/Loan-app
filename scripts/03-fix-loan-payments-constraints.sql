-- Reordering to drop trigger before function to avoid dependency errors

-- Drop existing trigger first (before dropping function)
DROP TRIGGER IF EXISTS check_payment_limits ON loan_payments;

-- Now we can safely drop the function
DROP FUNCTION IF EXISTS check_payment_limits();

-- Drop the existing unique constraint that prevents multiple payments per month
ALTER TABLE loan_payments 
DROP CONSTRAINT IF EXISTS loan_payments_loan_id_month_year_key;

-- Create a partial unique constraint that only applies to interest payments
-- This allows only one interest payment per loan per month
-- But allows multiple principal payments per month
CREATE UNIQUE INDEX IF NOT EXISTS loan_payments_interest_unique 
ON loan_payments (loan_id, month_year) 
WHERE payment_type = 'interest';

-- Create function to enforce payment limits
CREATE OR REPLACE FUNCTION check_payment_limits()
RETURNS TRIGGER AS $$
DECLARE
  interest_count INTEGER;
BEGIN
  -- Check interest payments for the month
  IF NEW.payment_type = 'interest' THEN
    SELECT COUNT(*) INTO interest_count
    FROM loan_payments
    WHERE loan_id = NEW.loan_id
      AND month_year = NEW.month_year
      AND payment_type = 'interest'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF interest_count > 0 THEN
      RAISE EXCEPTION 'Interest payment already recorded for this month';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce payment limits
CREATE TRIGGER check_payment_limits
  BEFORE INSERT OR UPDATE ON loan_payments
  FOR EACH ROW
  EXECUTE FUNCTION check_payment_limits();
