-- Complete Database Redesign for Loan Management System
-- This script drops and recreates monthly_loan_records, loans, and loan_payments tables
-- with the exact column structure specified by the user

-- Drop all dependent triggers first
DROP TRIGGER IF EXISTS sync_payment_to_monthly_record_trigger ON loan_payments CASCADE;
DROP TRIGGER IF EXISTS sync_payment_to_ledger_trigger ON loan_payments CASCADE;
DROP TRIGGER IF EXISTS update_monthly_loan_records_updated_at ON monthly_loan_records CASCADE;
DROP TRIGGER IF EXISTS update_loans_updated_at ON loans CASCADE;
DROP TRIGGER IF EXISTS update_loan_payments_updated_at ON loan_payments CASCADE;

-- Drop all dependent functions
DROP FUNCTION IF EXISTS sync_payment_to_monthly_record() CASCADE;
DROP FUNCTION IF EXISTS sync_payment_to_ledger() CASCADE;
DROP FUNCTION IF EXISTS initialize_new_month(integer, integer) CASCADE;

-- Drop existing tables in reverse dependency order
DROP TABLE IF EXISTS loan_payments CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS monthly_loan_records CASCADE;

-- ============================================
-- 1. CREATE monthly_loan_records TABLE
-- ============================================
CREATE TABLE monthly_loan_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id text,
  total_loan_taken numeric DEFAULT 0,
  previous_month_principal_received numeric DEFAULT 0,
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  period_key text NOT NULL,
  CONSTRAINT monthly_loan_records_period_month_check CHECK (period_month >= 1 AND period_month <= 12),
  CONSTRAINT monthly_loan_records_unique_user_period UNIQUE(user_id, period_key)
);

-- ============================================
-- 2. CREATE loans TABLE
-- ============================================
CREATE TABLE loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id text UNIQUE,
  member_id text,
  loan_amount numeric NOT NULL,
  additional_principal numeric DEFAULT 0,
  interest_paid numeric DEFAULT 0,
  principal_paid numeric DEFAULT 0,
  remaining_balance numeric NOT NULL,
  monthly_emi numeric DEFAULT 0,
  status text DEFAULT 'active',
  payment_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  period_year integer,
  period_month integer,
  period_key text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT loans_period_month_check CHECK (period_month IS NULL OR (period_month >= 1 AND period_month <= 12)),
  CONSTRAINT loans_status_check CHECK (status IN ('active', 'paid', 'defaulted', 'pending'))
);

-- ============================================
-- 3. CREATE loan_payments TABLE
-- ============================================
CREATE TABLE loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id text NOT NULL,
  member_id text,
  amount numeric NOT NULL,
  additional_principal numeric DEFAULT 0,
  interest_paid numeric DEFAULT 0,
  principal_paid numeric DEFAULT 0,
  remaining_balance numeric NOT NULL,
  monthly_emi numeric DEFAULT 0,
  status text DEFAULT 'paid',
  payment_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  period_key text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT loan_payments_period_month_check CHECK (period_month >= 1 AND period_month <= 12),
  CONSTRAINT loan_payments_status_check CHECK (status IN ('paid', 'pending', 'failed'))
);

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- monthly_loan_records indexes
CREATE INDEX idx_monthly_loan_records_user_id ON monthly_loan_records(user_id);
CREATE INDEX idx_monthly_loan_records_member_id ON monthly_loan_records(member_id);
CREATE INDEX idx_monthly_loan_records_period_key ON monthly_loan_records(period_key);
CREATE INDEX idx_monthly_loan_records_status ON monthly_loan_records(status);

-- loans indexes
CREATE INDEX idx_loans_loan_id ON loans(loan_id);
CREATE INDEX idx_loans_user_id ON loans(user_id);
CREATE INDEX idx_loans_member_id ON loans(member_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_period_key ON loans(period_key);

-- loan_payments indexes
CREATE INDEX idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX idx_loan_payments_user_id ON loan_payments(user_id);
CREATE INDEX idx_loan_payments_member_id ON loan_payments(member_id);
CREATE INDEX idx_loan_payments_period_key ON loan_payments(period_key);
CREATE INDEX idx_loan_payments_payment_date ON loan_payments(payment_date);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE monthly_loan_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for monthly_loan_records
CREATE POLICY "Users can view their own monthly records"
  ON monthly_loan_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monthly records"
  ON monthly_loan_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly records"
  ON monthly_loan_records FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for loans
CREATE POLICY "Users can view their own loans"
  ON loans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own loans"
  ON loans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own loans"
  ON loans FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for loan_payments
CREATE POLICY "Users can view their own loan payments"
  ON loan_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own loan payments"
  ON loan_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own loan payments"
  ON loan_payments FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- CREATE UPDATE TRIGGERS FOR updated_at
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for monthly_loan_records
CREATE TRIGGER update_monthly_loan_records_updated_at
  BEFORE UPDATE ON monthly_loan_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for loans
CREATE TRIGGER update_loans_updated_at
  BEFORE UPDATE ON loans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for loan_payments
CREATE TRIGGER update_loan_payments_updated_at
  BEFORE UPDATE ON loan_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Database schema redesign completed successfully!';
  RAISE NOTICE 'Tables created: monthly_loan_records, loans, loan_payments';
  RAISE NOTICE 'All indexes, RLS policies, and triggers have been set up.';
END $$;
