-- ===========================================
-- LEDGER-BASED ACCOUNTING SYSTEM
-- Single Source of Truth for All Transactions
-- ===========================================

-- Step 1: Create the canonical transactions ledger table
CREATE TABLE IF NOT EXISTS public.transactions_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  member_id TEXT NOT NULL, -- V01, V02, etc.
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  
  -- Transaction details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'subscription_fee',      -- Monthly membership fee
    'principal_payment',     -- Loan principal repayment
    'interest_payment',      -- Interest payment
    'penalty',              -- Late payment penalty
    'interest_accrual',     -- System-generated interest calculation
    'loan_disbursement',    -- Loan issued to member
    'new_loan'             -- New loan created
  )),
  
  amount NUMERIC(12, 2) NOT NULL,
  
  -- Payment metadata
  payment_channel TEXT CHECK (payment_channel IN ('cash', 'bank', 'upi', 'online', 'system')),
  receipt_number TEXT,
  client_reference_id TEXT UNIQUE, -- For idempotency
  
  -- Allocation details (when payment is split)
  allocated_to_subscription NUMERIC(12, 2) DEFAULT 0,
  allocated_to_penalty NUMERIC(12, 2) DEFAULT 0,
  allocated_to_interest NUMERIC(12, 2) DEFAULT 0,
  allocated_to_principal NUMERIC(12, 2) DEFAULT 0,
  
  -- Month tracking
  month_year TEXT NOT NULL, -- Format: "2025-12"
  
  -- Audit trail
  notes TEXT,
  allocation_reason TEXT, -- Why admin changed default allocation
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete
  deleted_by UUID REFERENCES public.profiles(id),
  deletion_reason TEXT
);

-- Create indexes for performance
CREATE INDEX idx_ledger_member_date ON public.transactions_ledger(member_id, transaction_date);
CREATE INDEX idx_ledger_user_date ON public.transactions_ledger(user_id, transaction_date);
CREATE INDEX idx_ledger_loan_date ON public.transactions_ledger(loan_id, transaction_date);
CREATE INDEX idx_ledger_month_year ON public.transactions_ledger(month_year);
CREATE INDEX idx_ledger_type ON public.transactions_ledger(transaction_type);
CREATE INDEX idx_ledger_reference ON public.transactions_ledger(client_reference_id) WHERE client_reference_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.transactions_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ledger" ON public.transactions_ledger
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can view own ledger" ON public.transactions_ledger
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Step 2: Enhance monthly_loan_records to track finalization properly
ALTER TABLE public.monthly_loan_records 
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS previous_total_income NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_outstanding NUMERIC(12, 2) DEFAULT 0;

-- Step 3: Add fields to profiles for monthly subscription tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fine NUMERIC(12, 2) DEFAULT 0;

-- Step 4: Create view for real-time member balances from ledger
CREATE OR REPLACE VIEW member_current_balance AS
SELECT 
  p.id as user_id,
  p.member_id,
  p.full_name,
  p.email,
  p.monthly_subscription,
  
  -- Calculate principal outstanding
  COALESCE(SUM(
    CASE 
      WHEN l.transaction_type = 'loan_disbursement' THEN l.amount
      WHEN l.transaction_type = 'new_loan' THEN l.amount
      WHEN l.transaction_type = 'principal_payment' THEN -l.allocated_to_principal
      ELSE 0
    END
  ), 0) as principal_outstanding,
  
  -- Calculate interest outstanding
  COALESCE(SUM(
    CASE 
      WHEN l.transaction_type = 'interest_accrual' THEN l.amount
      WHEN l.transaction_type = 'interest_payment' THEN -l.allocated_to_interest
      ELSE 0
    END
  ), 0) as interest_outstanding,
  
  -- Calculate total paid
  COALESCE(SUM(
    CASE 
      WHEN l.transaction_type = 'principal_payment' THEN l.allocated_to_principal
      ELSE 0
    END
  ), 0) as total_principal_paid,
  
  COALESCE(SUM(
    CASE 
      WHEN l.transaction_type = 'interest_payment' THEN l.allocated_to_interest
      ELSE 0
    END
  ), 0) as total_interest_paid,
  
  -- Calculate penalties
  COALESCE(SUM(
    CASE 
      WHEN l.transaction_type = 'penalty' THEN l.amount
      ELSE 0
    END
  ), 0) as total_penalties
  
FROM public.profiles p
LEFT JOIN public.transactions_ledger l ON p.member_id = l.member_id AND l.deleted_at IS NULL
WHERE p.role = 'member'
GROUP BY p.id, p.member_id, p.full_name, p.email, p.monthly_subscription;

-- Step 5: Create a function to calculate interest for a given principal and rate
CREATE OR REPLACE FUNCTION calculate_monthly_interest(
  principal NUMERIC,
  annual_rate NUMERIC DEFAULT 18.0
)
RETURNS NUMERIC AS $$
BEGIN
  -- Monthly interest = Principal × (Annual Rate / 12) / 100
  RETURN ROUND((principal * (annual_rate / 12.0) / 100.0), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 6: Create function to initialize month with proper carry-forward
CREATE OR REPLACE FUNCTION initialize_month_from_ledger(
  target_month_year TEXT,
  target_month INT,
  target_year INT
)
RETURNS JSONB AS $$
DECLARE
  record_count INT := 0;
  member_record RECORD;
BEGIN
  -- For each member, create a monthly record by aggregating ledger
  FOR member_record IN
    SELECT 
      p.id as user_id,
      p.member_id,
      p.monthly_subscription,
      COALESCE(SUM(
        CASE 
          WHEN l.transaction_type IN ('loan_disbursement', 'new_loan') THEN l.amount
          WHEN l.transaction_type = 'principal_payment' THEN -l.allocated_to_principal
          ELSE 0
        END
      ), 0) as opening_principal,
      COALESCE(SUM(
        CASE 
          WHEN l.transaction_type = 'interest_accrual' THEN l.amount
          WHEN l.transaction_type = 'interest_payment' THEN -l.allocated_to_interest
          ELSE 0
        END
      ), 0) as opening_interest
    FROM public.profiles p
    LEFT JOIN public.transactions_ledger l ON p.member_id = l.member_id AND l.deleted_at IS NULL
    WHERE p.role = 'member'
    GROUP BY p.id, p.member_id, p.monthly_subscription
  LOOP
    -- Calculate interest for this month
    DECLARE
      monthly_interest NUMERIC := calculate_monthly_interest(member_record.opening_principal);
    BEGIN
      INSERT INTO public.monthly_loan_records (
        user_id,
        month_year,
        month_number,
        year_number,
        monthly_subscription,
        opening_outstanding,
        interest_calculated,
        closing_outstanding,
        status,
        is_draft,
        created_at
      ) VALUES (
        member_record.user_id,
        target_month_year,
        target_month,
        target_year,
        member_record.monthly_subscription,
        member_record.opening_principal + member_record.opening_interest,
        monthly_interest,
        member_record.opening_principal + member_record.opening_interest + monthly_interest,
        'open',
        true,
        NOW()
      );
      
      record_count := record_count + 1;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Initialized %s records for %s', record_count, target_month_year),
    'count', record_count
  );
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create function to finalize a month (lock it)
CREATE OR REPLACE FUNCTION finalize_month(
  target_month_year TEXT,
  admin_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE public.monthly_loan_records
  SET 
    is_draft = false,
    finalized_at = NOW(),
    finalized_by = admin_user_id,
    locked_by = admin_user_id,
    locked_at = NOW(),
    status = 'finalized'
  WHERE month_year = target_month_year AND is_draft = true;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Finalized %s records for %s', updated_count, target_month_year),
    'count', updated_count
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.transactions_ledger IS 'Single source of truth for all financial transactions';
COMMENT ON TABLE public.monthly_loan_records IS 'Derived monthly snapshots for reporting (denormalized)';
COMMENT ON VIEW member_current_balance IS 'Real-time member balances calculated from ledger';
