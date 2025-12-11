-- Remove redundant monthly_contribution column from profiles
-- Keep only monthly_subscription as the single source of truth

-- First, copy any data from monthly_contribution to monthly_subscription if monthly_subscription is null
UPDATE profiles 
SET monthly_subscription = COALESCE(monthly_subscription, monthly_contribution, 0)
WHERE monthly_subscription IS NULL OR monthly_subscription = 0;

-- Drop the redundant column
ALTER TABLE profiles DROP COLUMN IF EXISTS monthly_contribution CASCADE;

-- Add comment to clarify the column purpose
COMMENT ON COLUMN profiles.monthly_subscription IS 'Monthly subscription fee amount that member pays (e.g., ₹2,100)';
