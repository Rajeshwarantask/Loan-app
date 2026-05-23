-- Find profiles that don't have any loan records and create subscription_only users for them
-- This restores deleted subscription_only users who haven't taken an active loan yet

INSERT INTO loans (id, user_id, member_id, loan_amount, status, period_year, period_month, period_key, created_at, updated_at, full_name, interest_rate, original_loan_amount)
SELECT 
  gen_random_uuid() as id,
  p.id as user_id,
  p.member_id,
  0 as loan_amount,
  'subscription_only' as status,
  EXTRACT(YEAR FROM NOW())::integer as period_year,
  EXTRACT(MONTH FROM NOW())::integer as period_month,
  TO_CHAR(NOW(), 'YYYY-MM') as period_key,
  NOW() as created_at,
  NOW() as updated_at,
  p.full_name,
  0 as interest_rate,
  0 as original_loan_amount
FROM profiles p
WHERE p.id NOT IN (
  SELECT DISTINCT user_id FROM loans WHERE user_id IS NOT NULL
)
AND p.role != 'admin'
ON CONFLICT DO NOTHING;
