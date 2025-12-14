-- Fix RLS policies to allow admins to delete loan payments

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Admins can delete loan_payments" ON loan_payments;

-- Create new delete policy for admins
CREATE POLICY "Admins can delete loan_payments"
ON loan_payments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Also ensure the additional_loan table allows admin deletes
DROP POLICY IF EXISTS "Admins can delete additional_loan" ON additional_loan;

CREATE POLICY "Admins can delete additional_loan"
ON additional_loan
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
