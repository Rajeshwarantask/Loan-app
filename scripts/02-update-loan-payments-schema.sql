-- Add columns to track payment types and monthly limits
ALTER TABLE loan_payments
ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('interest', 'principal')),
ADD COLUMN IF NOT EXISTS payment_month INTEGER,
ADD COLUMN IF NOT EXISTS payment_year INTEGER,
ADD COLUMN IF NOT EXISTS principal_remaining NUMERIC,
ADD COLUMN IF NOT EXISTS outstanding_interest NUMERIC;

-- Create index for faster queries on month/year
CREATE INDEX IF NOT EXISTS idx_loan_payments_month_year 
ON loan_payments(loan_id, payment_year, payment_month, payment_type);

-- Add columns to loans table to track principal and interest
ALTER TABLE loans
ADD COLUMN IF NOT EXISTS principal_remaining NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS outstanding_interest NUMERIC DEFAULT 0;

-- Initialize principal_remaining for existing loans
UPDATE loans
SET principal_remaining = amount
WHERE principal_remaining IS NULL OR principal_remaining = 0;

-- Create a function to check payment limits
CREATE OR REPLACE FUNCTION check_payment_limits()
RETURNS TRIGGER AS $$
DECLARE
  payment_count INTEGER;
  current_month INTEGER;
  current_year INTEGER;
BEGIN
  current_month := EXTRACT(MONTH FROM NEW.payment_date);
  current_year := EXTRACT(YEAR FROM NEW.payment_date);
  
  -- Check interest payment limit (once per month)
  IF NEW.payment_type = 'interest' THEN
    SELECT COUNT(*) INTO payment_count
    FROM loan_payments
    WHERE loan_id = NEW.loan_id
      AND payment_type = 'interest'
      AND payment_month = current_month
      AND payment_year = current_year;
    
    IF payment_count > 0 THEN
      RAISE EXCEPTION 'Interest can only be recorded once per month for this loan';
    END IF;
  END IF;
  
  -- Check principal payment limit (max 2 per month)
  IF NEW.payment_type = 'principal' THEN
    SELECT COUNT(*) INTO payment_count
    FROM loan_payments
    WHERE loan_id = NEW.loan_id
      AND payment_type = 'principal'
      AND payment_month = current_month
      AND payment_year = current_year;
    
    IF payment_count >= 2 THEN
      RAISE EXCEPTION 'Principal can only be recorded twice per month for this loan';
    END IF;
  END IF;
  
  -- Set payment month and year
  NEW.payment_month := current_month;
  NEW.payment_year := current_year;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS check_payment_limits_trigger ON loan_payments;
CREATE TRIGGER check_payment_limits_trigger
BEFORE INSERT ON loan_payments
FOR EACH ROW
EXECUTE FUNCTION check_payment_limits();
