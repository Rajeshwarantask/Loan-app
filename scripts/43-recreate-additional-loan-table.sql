-- Drop the incorrectly created additional_loan table
DROP TABLE IF EXISTS additional_loan CASCADE;

-- Recreate additional_loan table with correct column types and foreign key
CREATE TABLE IF NOT EXISTS additional_loan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  additional_loan_amount NUMERIC NOT NULL,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  period_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for additional_loan table
ALTER TABLE additional_loan ENABLE ROW LEVEL SECURITY;

-- Users can view their own additional loans
CREATE POLICY "Users can view their own additional loans"
  ON additional_loan FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own additional loans
CREATE POLICY "Users can insert their own additional loans"
  ON additional_loan FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all additional loans
CREATE POLICY "Admins can view all additional loans"
  ON additional_loan FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins can manage all additional loans
CREATE POLICY "Admins can manage all additional loans"
  ON additional_loan FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create indexes for better query performance
CREATE INDEX idx_additional_loan_user_id ON additional_loan(user_id);
CREATE INDEX idx_additional_loan_member_id ON additional_loan(member_id);
CREATE INDEX idx_additional_loan_loan_id ON additional_loan(loan_id);
CREATE INDEX idx_additional_loan_period_key ON additional_loan(period_key);
CREATE INDEX idx_additional_loan_user_period ON additional_loan(user_id, period_key);
