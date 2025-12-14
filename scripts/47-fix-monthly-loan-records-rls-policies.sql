-- Fix RLS policies for monthly_loan_records table to allow admin deletions

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own monthly records" ON monthly_loan_records;
DROP POLICY IF EXISTS "Admins can view all monthly records" ON monthly_loan_records;
DROP POLICY IF EXISTS "Admins can insert monthly records" ON monthly_loan_records;
DROP POLICY IF EXISTS "Admins can update monthly records" ON monthly_loan_records;
DROP POLICY IF EXISTS "Admins can delete monthly records" ON monthly_loan_records;

-- Enable RLS
ALTER TABLE monthly_loan_records ENABLE ROW LEVEL SECURITY;

-- Users can view their own monthly records
CREATE POLICY "Users can view own monthly records" ON monthly_loan_records
  FOR SELECT
  USING (
    auth.uid() = user_id
  );

-- Admins can view all monthly records
CREATE POLICY "Admins can view all monthly records" ON monthly_loan_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can insert monthly records
CREATE POLICY "Admins can insert monthly records" ON monthly_loan_records
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update monthly records
CREATE POLICY "Admins can update monthly records" ON monthly_loan_records
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can delete monthly records
CREATE POLICY "Admins can delete monthly records" ON monthly_loan_records
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
