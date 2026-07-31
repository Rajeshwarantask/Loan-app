-- Populate opening_balance for all existing loan_payments records
-- Uses the existing get_opening_balance() function with priority logic:
-- 1. Previous month's remaining_balance
-- 2. Original loan amount (if first month)
-- 3. Reconstructed value (fallback)

-- IMPORTANT: Run migration 74 FIRST to create get_opening_balance() function
-- This migration depends on that function existing

-- Step 1: Update all existing records that don't have opening_balance populated
-- Strategy: For each payment, use the previous period's closing balance or original loan amount
UPDATE loan_payments
SET opening_balance = COALESCE(
  -- Priority 1: Previous month's remaining_balance
  (
    SELECT remaining_balance
    FROM loan_payments lp2
    WHERE lp2.user_id = loan_payments.user_id
      AND (
        (SUBSTRING(lp2.period_key, 1, 4)::INTEGER < SUBSTRING(loan_payments.period_key, 1, 4)::INTEGER)
        OR (
          SUBSTRING(lp2.period_key, 1, 4)::INTEGER = SUBSTRING(loan_payments.period_key, 1, 4)::INTEGER
          AND SUBSTRING(lp2.period_key, 6, 2)::INTEGER < SUBSTRING(loan_payments.period_key, 6, 2)::INTEGER
        )
      )
    ORDER BY lp2.period_year DESC, lp2.period_month DESC
    LIMIT 1
  ),
  -- Priority 2: Original loan amount (if first month)
  (
    SELECT original_loan_amount
    FROM loans l
    WHERE l.user_id = loan_payments.user_id
      AND l.status IN ('active', 'subscription_only')
    LIMIT 1
  ),
  -- Priority 3: Reconstruct from original loans minus cumulative principal
  COALESCE(
    (
      SELECT COALESCE(SUM(l.original_loan_amount), 0) 
             - COALESCE(
               (SELECT SUM(lp3.monthly_emi + lp3.additional_principal)
                FROM loan_payments lp3
                WHERE lp3.user_id = loan_payments.user_id
                  AND (lp3.period_year < SUBSTRING(loan_payments.period_key, 1, 4)::INTEGER 
                       OR (lp3.period_year = SUBSTRING(loan_payments.period_key, 1, 4)::INTEGER 
                           AND lp3.period_month < SUBSTRING(loan_payments.period_key, 6, 2)::INTEGER))),
               0
             )
      FROM loans l
      WHERE l.user_id = loan_payments.user_id
        AND l.status IN ('active', 'subscription_only')
    ),
    0
  )
)
WHERE opening_balance IS NULL
  OR opening_balance = 0;

-- Step 2: Create or replace the trigger function for new records
DROP FUNCTION IF EXISTS ensure_opening_balance_on_insert() CASCADE;

CREATE OR REPLACE FUNCTION ensure_opening_balance_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.opening_balance IS NULL THEN
    NEW.opening_balance := COALESCE(
      -- Priority 1: Previous month's remaining_balance
      (
        SELECT remaining_balance
        FROM loan_payments lp2
        WHERE lp2.user_id = NEW.user_id
          AND (
            (SUBSTRING(lp2.period_key, 1, 4)::INTEGER < SUBSTRING(NEW.period_key, 1, 4)::INTEGER)
            OR (
              SUBSTRING(lp2.period_key, 1, 4)::INTEGER = SUBSTRING(NEW.period_key, 1, 4)::INTEGER
              AND SUBSTRING(lp2.period_key, 6, 2)::INTEGER < SUBSTRING(NEW.period_key, 6, 2)::INTEGER
            )
          )
        ORDER BY lp2.period_year DESC, lp2.period_month DESC
        LIMIT 1
      ),
      -- Priority 2: Original loan amount
      (
        SELECT original_loan_amount
        FROM loans l
        WHERE l.user_id = NEW.user_id
          AND l.status IN ('active', 'subscription_only')
        LIMIT 1
      ),
      0
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_ensure_opening_balance_on_insert ON loan_payments;

-- Step 4: Create trigger to auto-populate opening_balance on insert
CREATE TRIGGER trg_ensure_opening_balance_on_insert
BEFORE INSERT ON loan_payments
FOR EACH ROW
EXECUTE FUNCTION ensure_opening_balance_on_insert();

-- Step 5: Verify all records now have opening_balance populated
-- Run this query to verify: SELECT COUNT(*) as records_without_opening_balance FROM loan_payments WHERE opening_balance IS NULL OR opening_balance = 0;
