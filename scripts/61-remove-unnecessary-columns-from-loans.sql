-- Migration to remove unnecessary columns from loans table
-- The additional_principal and principal_paid columns are redundant now
-- because:
-- 1. Additional loans are stored in the additional_loan table
-- 2. Principal payments are tracked in loan_payment table with emi_paid column
-- 3. This keeps the loans table focused on loan configuration/metadata only

BEGIN;

-- Drop the columns
ALTER TABLE loans DROP COLUMN IF EXISTS additional_principal;
ALTER TABLE loans DROP COLUMN IF EXISTS principal_paid;

-- Add comment documenting the removal
COMMENT ON TABLE loans IS 'Core loan information. Additional loans tracked in additional_loan table, payment history in loan_payment table.';

COMMIT;
