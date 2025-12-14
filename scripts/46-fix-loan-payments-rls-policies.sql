-- Enable RLS on loan_payments table
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own payments" ON loan_payments;
DROP POLICY IF EXISTS "Users can insert their own payments" ON loan_payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON loan_payments;
DROP POLICY IF EXISTS "Admins can insert payments" ON loan_payments;

-- Policy for users to view their own payments
CREATE POLICY "Users can view their own payments"
ON loan_payments
FOR SELECT
USING (
  auth.uid() = user_id
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Policy for admins to insert payments
CREATE POLICY "Admins can insert payments"
ON loan_payments
FOR INSERT
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Policy for admins to update payments
CREATE POLICY "Admins can update payments"
ON loan_payments
FOR UPDATE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
