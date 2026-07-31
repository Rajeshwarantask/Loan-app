-- Populate opening_balance for all existing loan_payments records
-- Uses the existing get_opening_balance() function with priority logic:
-- 1. Previous month's remaining_balance
-- 2. Original loan amount (if first month)
-- 3. Reconstructed value (fallback)

-- Update all existing records that don't have opening_balance populated
UPDATE loan_payments
SET opening_balance = get_opening_balance(user_id, period_key)
WHERE opening_balance IS NULL;

-- Verify all records now have opening_balance populated
-- This query shows any records that still don't have a value (should be empty)
-- SELECT COUNT(*) as records_without_opening_balance
-- FROM loan_payments
-- WHERE opening_balance IS NULL;

-- Update column to be NOT NULL for data integrity
ALTER TABLE loan_payments
ALTER COLUMN opening_balance SET NOT NULL;

-- Create function to ensure opening_balance is always set for new records
-- This is called via trigger before insert
CREATE OR REPLACE FUNCTION ensure_opening_balance_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.opening_balance IS NULL THEN
    NEW.opening_balance := get_opening_balance(NEW.user_id, NEW.period_key);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trg_ensure_opening_balance_on_insert ON loan_payments;

-- Create trigger to auto-populate opening_balance on insert
CREATE TRIGGER trg_ensure_opening_balance_on_insert
BEFORE INSERT ON loan_payments
FOR EACH ROW
EXECUTE FUNCTION ensure_opening_balance_on_insert();
