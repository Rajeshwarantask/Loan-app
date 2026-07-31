-- ========================================================================
-- OPENING BALANCE DEPLOYMENT - STANDALONE SQL
-- ========================================================================
-- Copy and paste this ENTIRE file into Supabase SQL Editor
-- This includes BOTH migrations 75 & 76 in one file
-- ========================================================================

-- ========================================================================
-- MIGRATION 75: Add Column & Index
-- ========================================================================

ALTER TABLE loan_payments
ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_loan_payments_opening_balance
  ON loan_payments(user_id, period_key, opening_balance);

COMMENT ON COLUMN loan_payments.opening_balance IS
  'Opening balance for this payment period. Used to calculate interest due for the period.
   Formula: interest_due = opening_balance × interest_rate / 100';

-- ========================================================================
-- MIGRATION 76: Backfill Existing Records & Create Trigger
-- ========================================================================

-- Step 1: Update all existing records that don't have opening_balance populated
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

-- ========================================================================
-- VERIFICATION QUERY (Run after deployment)
-- ========================================================================
-- SELECT COUNT(*) as records_without_opening_balance
-- FROM loan_payments
-- WHERE opening_balance IS NULL OR opening_balance = 0;
-- 
-- Expected result: 0
