-- Fix RLS policies for loans table to allow admins to insert/update

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own loans" ON loans;
DROP POLICY IF EXISTS "Admins can view all loans" ON loans;
DROP POLICY IF EXISTS "Admins can insert loans" ON loans;
DROP POLICY IF EXISTS "Admins can update loans" ON loans;
DROP POLICY IF EXISTS "Admins can delete loans" ON loans;

-- Enable RLS on loans table
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own loans
CREATE POLICY "Users can view their own loans"
ON loans
FOR SELECT
USING (
  auth.uid() = user_id
);

-- Policy: Admins can view all loans
CREATE POLICY "Admins can view all loans"
ON loans
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can insert loans
CREATE POLICY "Admins can insert loans"
ON loans
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can update loans
CREATE POLICY "Admins can update loans"
ON loans
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can delete loans
CREATE POLICY "Admins can delete loans"
ON loans
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
