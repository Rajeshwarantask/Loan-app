-- Full Database Normalization Script
-- This removes duplicate data and creates proper relationships

-- Keep monthly_subscription in profiles - it's a user attribute, not duplicate data
-- Only remove calculated/duplicate loan data

-- Step 1: Remove redundant calculated fields from loans table
ALTER TABLE loans 
  DROP COLUMN IF EXISTS loan_balance,
  DROP COLUMN IF EXISTS emi_balance;

-- Step 2: Ensure profiles table uses monthly_subscription (already has this field)
-- No changes needed - monthly_subscription is the correct field name

-- Step 3: Ensure loans table only stores core loan information
-- Keep: amount, interest_rate, installment_duration_months, monthly_emi_amount, emi_monthly_interest
-- These are the agreed-upon terms that don't change

-- Step 4: Create a view for current loan balances (calculated from payments)
CREATE OR REPLACE VIEW loan_current_balances AS
SELECT 
  l.id as loan_id,
  l.user_id,
  l.amount as original_amount,
  l.interest_rate,
  l.monthly_emi_amount,
  l.emi_monthly_interest,
  l.installment_duration_months,
  COALESCE(SUM(lp.principal_paid), 0) as total_principal_paid,
  COALESCE(SUM(lp.interest_paid), 0) as total_interest_paid,
  l.amount - COALESCE(SUM(lp.principal_paid), 0) as current_principal_balance,
  COALESCE(MAX(lp.month_year), NULL) as last_payment_month,
  l.status,
  l.created_at,
  l.approved_at
FROM loans l
LEFT JOIN loan_payments lp ON l.id = lp.loan_id
WHERE l.status != 'rejected'
GROUP BY l.id, l.user_id, l.amount, l.interest_rate, l.monthly_emi_amount, 
         l.emi_monthly_interest, l.installment_duration_months, l.status, 
         l.created_at, l.approved_at;

-- Step 5: Create a view for member financial summary (replaces duplicate data in profiles)
CREATE OR REPLACE VIEW member_financial_summary AS
SELECT 
  p.id as user_id,
  p.member_id,
  p.full_name,
  p.email,
  p.phone,
  p.monthly_subscription,
  p.fine,
  -- Current month contribution
  COALESCE(mc_current.amount, 0) as current_month_contribution,
  mc_current.status as contribution_status,
  mc_current.payment_date as contribution_payment_date,
  -- Total contributions
  COALESCE(SUM(mc_all.amount), 0) as total_contributions,
  -- Active loan summary
  lcb.loan_id,
  lcb.current_principal_balance,
  lcb.monthly_emi_amount,
  lcb.emi_monthly_interest,
  lcb.total_principal_paid,
  lcb.total_interest_paid,
  -- Calculate months remaining
  CASE 
    WHEN lcb.monthly_emi_amount > 0 AND lcb.current_principal_balance > 0
    THEN CEIL(lcb.current_principal_balance / lcb.monthly_emi_amount)
    ELSE 0 
  END as installment_months_remaining,
  -- Calculate total loan balance (principal + remaining interest)
  CASE 
    WHEN lcb.current_principal_balance > 0 
    THEN lcb.current_principal_balance + (
      CEIL(lcb.current_principal_balance / NULLIF(lcb.monthly_emi_amount, 0)) * lcb.emi_monthly_interest
    )
    ELSE 0 
  END as total_loan_balance
FROM profiles p
LEFT JOIN monthly_contributions mc_current ON 
  p.id = mc_current.user_id AND 
  mc_current.month_year = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
LEFT JOIN monthly_contributions mc_all ON p.id = mc_all.user_id
LEFT JOIN loan_current_balances lcb ON 
  p.id = lcb.user_id AND 
  lcb.status = 'approved'
GROUP BY 
  p.id, p.member_id, p.full_name, p.email, p.phone, p.monthly_subscription, p.fine,
  mc_current.amount, mc_current.status, mc_current.payment_date,
  lcb.loan_id, lcb.current_principal_balance, lcb.monthly_emi_amount, 
  lcb.emi_monthly_interest, lcb.total_principal_paid, lcb.total_interest_paid;

-- Step 6: Create optimized view for cash bill data (replaces member_cash_bill_data)
CREATE OR REPLACE VIEW member_cash_bill_data AS
SELECT 
  mfs.user_id,
  mfs.member_id,
  mfs.full_name as name,
  mfs.monthly_subscription as subscription_income,
  COALESCE(mfs.current_principal_balance, 0) as loan_balance,
  COALESCE(mfs.emi_monthly_interest, 0) as monthly_interest,
  COALESCE(mfs.current_principal_balance, 0) as updated_principal_balance,
  COALESCE(mfs.monthly_emi_amount, 0) as monthly_installment,
  COALESCE(mfs.emi_monthly_interest, 0) as installment_interest,
  COALESCE(mfs.installment_months_remaining, 0) as interest_months,
  COALESCE(mfs.total_loan_balance, 0) as total_loan_balance,
  COALESCE(mfs.fine, 0) as fine,
  -- Total amount to be paid this month
  COALESCE(mfs.monthly_subscription, 0) + 
  COALESCE(mfs.monthly_emi_amount, 0) + 
  COALESCE(mfs.fine, 0) as total_amount_to_pay
FROM member_financial_summary mfs
ORDER BY mfs.member_id;

-- Step 7: Add helpful comments
COMMENT ON VIEW loan_current_balances IS 'Calculates current loan balances from payment history - single source of truth for loan status';
COMMENT ON VIEW member_financial_summary IS 'Comprehensive member financial data without duplication - aggregates from normalized tables';
COMMENT ON VIEW member_cash_bill_data IS 'Cash bill statement data - all values calculated from source tables';

-- Step 8: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_monthly_contributions_user_month ON monthly_contributions(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loans_user_status ON loans(user_id, status);
