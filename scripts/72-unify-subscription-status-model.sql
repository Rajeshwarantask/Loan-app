-- Migration: 72-unify-subscription-status-model.sql
-- Purpose: Convert subscription-only users into loans table with status='subscription_only'
-- This unifies the data model so all payment tracking uses the loans table

-- Step 1: Create loan records for all subscription-only users (those without existing loans)
-- These users will have:
-- - loan_amount = 0 (no actual loan, just subscription)
-- - status = 'subscription_only'
-- - interest_rate = 0
-- - duration_months = NULL (ongoing subscription)

INSERT INTO loans (
  id,
  user_id,
  loan_amount,
  interest_rate,
  status,
  created_at,
  updated_at,
  member_id,
  full_name,
  period_key,
  period_month,
  period_year,
  purpose
)
SELECT 
  gen_random_uuid() as id,
  p.id as user_id,
  0 as loan_amount,  -- No actual loan, just subscription
  0 as interest_rate,
  'subscription_only' as status,
  NOW() as created_at,
  NOW() as updated_at,
  p.member_id,
  p.full_name,
  CONCAT(EXTRACT(YEAR FROM NOW())::text, '-', LPAD(EXTRACT(MONTH FROM NOW())::text, 2, '0')) as period_key,
  EXTRACT(MONTH FROM NOW())::integer as period_month,
  EXTRACT(YEAR FROM NOW())::integer as period_year,
  'Monthly Subscription' as purpose
FROM profiles p
WHERE p.id NOT IN (
  SELECT DISTINCT user_id FROM loans WHERE status IN ('active', 'completed')
)
AND p.id NOT IN (
  SELECT DISTINCT user_id FROM loans WHERE status = 'subscription_only'
);

-- Step 2: Add a comment documenting the new status values
COMMENT ON COLUMN loans.status IS 'Loan status: "active" (has outstanding balance), "subscription_only" (subscription payments only, no loan), "completed" (fully paid), "paid" (historical alias for completed)';
