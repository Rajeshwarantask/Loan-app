-- Create monthly loan records table for cycle-based management
CREATE TABLE IF NOT EXISTS monthly_loan_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- Format: "Jan 2025"
  month_number INTEGER NOT NULL, -- 1-12
  year_number INTEGER NOT NULL,
  
  -- Opening balances (from previous month closing)
  opening_outstanding NUMERIC DEFAULT 0,
  
  -- Monthly subscription
  monthly_subscription NUMERIC DEFAULT 2100,
  
  -- Activity during the month
  interest_calculated NUMERIC DEFAULT 0, -- Monthly interest on opening outstanding
  interest_paid NUMERIC DEFAULT 0,
  principal_paid NUMERIC DEFAULT 0, -- EMI + additional payments
  new_loan_taken NUMERIC DEFAULT 0,
  penalty NUMERIC DEFAULT 0,
  
  -- Closing balances (for next month)
  closing_outstanding NUMERIC DEFAULT 0, -- opening + new_loan - principal_paid
  
  -- Totals
  total_monthly_income NUMERIC DEFAULT 0, -- subscription + interest_paid + principal_paid + penalty
  
  -- Comparison
  previous_month_income NUMERIC DEFAULT 0,
  income_difference NUMERIC DEFAULT 0, -- total_monthly_income - previous_month_income
  
  -- Status
  status TEXT DEFAULT 'draft', -- draft, finalized
  finalized_at TIMESTAMP WITH TIME ZONE,
  finalized_by UUID REFERENCES profiles(id),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user per month
  UNIQUE(user_id, month_year)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_monthly_loan_records_user_month ON monthly_loan_records(user_id, year_number, month_number);
CREATE INDEX IF NOT EXISTS idx_monthly_loan_records_status ON monthly_loan_records(status);
CREATE INDEX IF NOT EXISTS idx_monthly_loan_records_month ON monthly_loan_records(year_number, month_number);

-- Enable RLS
ALTER TABLE monthly_loan_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage monthly records" ON monthly_loan_records;
DROP POLICY IF EXISTS "Users can view own monthly records" ON monthly_loan_records;

-- Policies
CREATE POLICY "Admins can manage monthly records" ON monthly_loan_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view own monthly records" ON monthly_loan_records
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS initialize_new_month(TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS calculate_monthly_interest(UUID);
DROP FUNCTION IF EXISTS finalize_monthly_record(UUID, UUID);

-- Simplified function to initialize a new month for all active members
CREATE OR REPLACE FUNCTION initialize_new_month(target_month TEXT, target_month_num INTEGER, target_year INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_inserted_count INTEGER;
  v_result JSONB;
BEGIN
  -- For each active member, create a new monthly record
  INSERT INTO monthly_loan_records (
    user_id,
    month_year,
    month_number,
    year_number,
    opening_outstanding,
    monthly_subscription,
    status
  )
  SELECT 
    p.id,
    target_month,
    target_month_num,
    target_year,
    COALESCE(
      (SELECT mlr.closing_outstanding 
       FROM monthly_loan_records mlr 
       WHERE mlr.user_id = p.id 
       ORDER BY mlr.year_number DESC, mlr.month_number DESC 
       LIMIT 1),
      COALESCE(
        (SELECT SUM(l.principal_remaining) 
         FROM loans l 
         WHERE l.user_id = p.id AND l.status = 'active'),
        0
      )
    ) as opening_outstanding,
    COALESCE(p.monthly_subscription, 2100),
    'draft'
  FROM profiles p
  WHERE p.role = 'member'
  ON CONFLICT (user_id, month_year) DO NOTHING;
  
  -- Get the count of inserted records
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  
  -- Return result as JSONB
  v_result := jsonb_build_object(
    'success', TRUE,
    'inserted_count', v_inserted_count,
    'message', format('Initialized %s records for %s', v_inserted_count, target_month)
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate monthly interest for a record
CREATE OR REPLACE FUNCTION calculate_monthly_interest(record_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_opening_outstanding NUMERIC;
  v_interest_rate NUMERIC;
  v_monthly_interest NUMERIC;
BEGIN
  -- Get opening outstanding and interest rate
  SELECT 
    mlr.opening_outstanding,
    COALESCE(
      (SELECT l.interest_rate FROM loans l WHERE l.user_id = mlr.user_id AND l.status = 'active' LIMIT 1),
      15
    )
  INTO v_opening_outstanding, v_interest_rate
  FROM monthly_loan_records mlr
  WHERE mlr.id = record_id;
  
  -- Calculate monthly interest
  v_monthly_interest := ROUND((v_opening_outstanding * v_interest_rate) / 100);
  
  -- Update the record
  UPDATE monthly_loan_records
  SET 
    interest_calculated = v_monthly_interest,
    updated_at = NOW()
  WHERE id = record_id;
  
  RETURN v_monthly_interest;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to finalize a monthly record
CREATE OR REPLACE FUNCTION finalize_monthly_record(record_id UUID, admin_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_opening NUMERIC;
  v_new_loan NUMERIC;
  v_principal_paid NUMERIC;
  v_subscription NUMERIC;
  v_interest_paid NUMERIC;
  v_penalty NUMERIC;
  v_prev_income NUMERIC;
BEGIN
  -- Get current values
  SELECT 
    opening_outstanding,
    new_loan_taken,
    principal_paid,
    monthly_subscription,
    interest_paid,
    penalty
  INTO 
    v_opening,
    v_new_loan,
    v_principal_paid,
    v_subscription,
    v_interest_paid,
    v_penalty
  FROM monthly_loan_records
  WHERE id = record_id;
  
  -- Get previous month income for comparison
  SELECT COALESCE(mlr.total_monthly_income, 0)
  INTO v_prev_income
  FROM monthly_loan_records mlr
  WHERE mlr.user_id = (SELECT user_id FROM monthly_loan_records WHERE id = record_id)
    AND (mlr.year_number < (SELECT year_number FROM monthly_loan_records WHERE id = record_id)
         OR (mlr.year_number = (SELECT year_number FROM monthly_loan_records WHERE id = record_id)
             AND mlr.month_number < (SELECT month_number FROM monthly_loan_records WHERE id = record_id)))
  ORDER BY mlr.year_number DESC, mlr.month_number DESC
  LIMIT 1;
  
  -- Calculate closing outstanding and totals
  UPDATE monthly_loan_records
  SET 
    closing_outstanding = v_opening + v_new_loan - v_principal_paid,
    total_monthly_income = v_subscription + v_interest_paid + v_principal_paid + v_penalty,
    previous_month_income = v_prev_income,
    income_difference = (v_subscription + v_interest_paid + v_principal_paid + v_penalty) - v_prev_income,
    status = 'finalized',
    finalized_at = NOW(),
    finalized_by = admin_id,
    updated_at = NOW()
  WHERE id = record_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE monthly_loan_records IS 'Stores monthly cycle-based loan records for each member';
COMMENT ON FUNCTION initialize_new_month IS 'Creates draft monthly records for all members for a new month';
COMMENT ON FUNCTION calculate_monthly_interest IS 'Calculates monthly interest based on opening outstanding';
COMMENT ON FUNCTION finalize_monthly_record IS 'Finalizes a monthly record with all calculations';
