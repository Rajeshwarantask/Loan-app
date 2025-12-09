-- Restore loan_payments table for backward compatibility
-- This allows existing components to continue working while we migrate to ledger-based system

-- Recreate loan_payments table
CREATE TABLE IF NOT EXISTS loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('interest', 'principal', 'emi')),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  month_year TEXT NOT NULL,
  interest_paid NUMERIC(10, 2) DEFAULT 0,
  principal_paid NUMERIC(10, 2) DEFAULT 0,
  remaining_balance NUMERIC(10, 2),
  status TEXT DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_user_id ON loan_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_month_year ON loan_payments(month_year);
CREATE INDEX IF NOT EXISTS idx_loan_payments_payment_date ON loan_payments(payment_date DESC);

-- Sync loan_payments from transactions_ledger
-- This ensures data consistency between old and new systems
INSERT INTO loan_payments (
  loan_id,
  user_id,
  amount,
  payment_type,
  payment_date,
  month_year,
  interest_paid,
  principal_paid,
  remaining_balance,
  status,
  notes,
  created_at
)
SELECT 
  tl.loan_id,
  tl.user_id,
  tl.amount,
  CASE 
    WHEN tl.transaction_type = 'interest_payment' THEN 'interest'
    WHEN tl.transaction_type = 'principal_payment' THEN 'principal'
    WHEN tl.transaction_type = 'emi_payment' THEN 'emi'
    ELSE 'principal'
  END as payment_type,
  tl.transaction_date as payment_date,
  COALESCE(tl.month_year, TO_CHAR(tl.transaction_date, 'YYYY-MM')) as month_year,
  tl.allocated_to_interest as interest_paid,
  tl.allocated_to_principal as principal_paid,
  0 as remaining_balance,
  'completed' as status,
  tl.notes,
  tl.created_at
FROM transactions_ledger tl
WHERE tl.transaction_type IN ('interest_payment', 'principal_payment', 'emi_payment', 'payment')
  AND tl.deleted_at IS NULL
  AND tl.loan_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM loan_payments lp 
    WHERE lp.user_id = tl.user_id 
      AND lp.amount = tl.amount 
      AND lp.payment_date = tl.transaction_date
  );

-- Create trigger to sync loan_payments to transactions_ledger
-- When a payment is inserted into loan_payments, also insert into ledger
CREATE OR REPLACE FUNCTION sync_payment_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_member_id TEXT;
BEGIN
  -- Fetch member_id from profiles table
  SELECT member_id INTO v_member_id
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Insert into ledger with proper member_id
  INSERT INTO transactions_ledger (
    user_id,
    member_id,
    loan_id,
    month_year,
    transaction_type,
    amount,
    allocated_to_subscription,
    allocated_to_interest,
    allocated_to_principal,
    allocated_to_penalty,
    transaction_date,
    notes,
    created_by
  )
  VALUES (
    NEW.user_id,
    v_member_id,
    NEW.loan_id,
    NEW.month_year,
    CASE NEW.payment_type
      WHEN 'interest' THEN 'interest_payment'
      WHEN 'principal' THEN 'principal_payment'
      WHEN 'emi' THEN 'emi_payment'
      ELSE 'payment'
    END,
    NEW.amount,
    0,
    COALESCE(NEW.interest_paid, 0),
    COALESCE(NEW.principal_paid, 0),
    0,
    NEW.payment_date,
    NEW.notes,
    NEW.user_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_payment_to_ledger_trigger ON loan_payments;
CREATE TRIGGER sync_payment_to_ledger_trigger
  AFTER INSERT ON loan_payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_payment_to_ledger();

-- Grant permissions
GRANT ALL ON loan_payments TO authenticated;
GRANT ALL ON loan_payments TO service_role;
