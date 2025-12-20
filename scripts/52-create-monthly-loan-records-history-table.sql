-- Create historical table for monthly_loan_records to preserve past month data
-- This table stores all completed month records to prevent data loss

CREATE TABLE IF NOT EXISTS monthly_loan_records_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  member_id text,
  total_loan_taken numeric DEFAULT 0,
  additional_principal numeric DEFAULT 0,
  monthly_interest_income numeric DEFAULT 0,
  new_loan_taken numeric DEFAULT 0,
  total_loan_outstanding numeric DEFAULT 0,
  monthly_installment_income numeric DEFAULT 0,
  monthly_subscription numeric DEFAULT 0,
  total_income_current_month numeric DEFAULT 0,
  previous_month_total_income numeric DEFAULT 0,
  difference numeric DEFAULT 0,
  previous_month_total_loan_outstanding numeric DEFAULT 0,
  penalty numeric DEFAULT 0,
  available_loan_amount numeric DEFAULT 0,
  status text DEFAULT 'active',
  period_year integer,
  period_month integer,
  period_key text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Track when this record was moved to history
  archived_at timestamp with time zone DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_monthly_records_history_user_id ON monthly_loan_records_history(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_records_history_period_key ON monthly_loan_records_history(period_key);
CREATE INDEX IF NOT EXISTS idx_monthly_records_history_member_id ON monthly_loan_records_history(member_id);

-- Enable RLS
ALTER TABLE monthly_loan_records_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for history table
DROP POLICY IF EXISTS "Users can view own monthly history" ON monthly_loan_records_history;
DROP POLICY IF EXISTS "Admins can view all monthly history" ON monthly_loan_records_history;
DROP POLICY IF EXISTS "Admins can insert monthly history" ON monthly_loan_records_history;

CREATE POLICY "Users can view own monthly history" ON monthly_loan_records_history
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can view all monthly history" ON monthly_loan_records_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert monthly history" ON monthly_loan_records_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
