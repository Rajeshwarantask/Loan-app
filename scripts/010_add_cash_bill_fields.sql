-- Add member tracking and cash bill fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS member_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS monthly_subscription DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS loan_balance DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_interest_received DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS installment_loan_taken DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS installment_duration INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_emi DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS emi_balance DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS emi_interest DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fine DECIMAL(10, 2) DEFAULT 0;

-- Create index on member_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_profiles_member_id ON public.profiles(member_id);
