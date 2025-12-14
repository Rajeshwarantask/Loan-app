-- Add monthly_subscription column to loan_payments table if it doesn't exist
ALTER TABLE loan_payments
ADD COLUMN IF NOT EXISTS monthly_subscription INTEGER DEFAULT 0;

-- Create index for monthly_subscription queries
CREATE INDEX IF NOT EXISTS idx_loan_payments_monthly_subscription 
ON loan_payments(monthly_subscription);
