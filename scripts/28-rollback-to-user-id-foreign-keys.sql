-- Rollback: Restore user_id as the primary foreign key
-- Keep member_id as display column only (not a foreign key)

-- Step 1: Drop the member_id foreign keys we created
ALTER TABLE loans 
  DROP CONSTRAINT IF EXISTS loans_member_id_fkey;

ALTER TABLE loan_requests 
  DROP CONSTRAINT IF EXISTS loan_requests_member_id_fkey;

ALTER TABLE loan_payments 
  DROP CONSTRAINT IF EXISTS loan_payments_member_id_fkey;

ALTER TABLE monthly_loan_records 
  DROP CONSTRAINT IF EXISTS monthly_loan_records_member_id_fkey;

-- Step 2: Restore user_id foreign keys
ALTER TABLE loans
  DROP CONSTRAINT IF EXISTS loans_user_id_fkey,
  ADD CONSTRAINT loans_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE loan_requests
  DROP CONSTRAINT IF EXISTS loan_requests_user_id_fkey,
  ADD CONSTRAINT loan_requests_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE loan_payments
  DROP CONSTRAINT IF EXISTS loan_payments_user_id_fkey,
  ADD CONSTRAINT loan_payments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE monthly_loan_records
  DROP CONSTRAINT IF EXISTS monthly_loan_records_user_id_fkey,
  ADD CONSTRAINT monthly_loan_records_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Step 3: Make member_id columns nullable and remove from primary/unique constraints
-- member_id is now just a display column, not required for referential integrity

ALTER TABLE loans 
  ALTER COLUMN member_id DROP NOT NULL;

ALTER TABLE loan_requests 
  ALTER COLUMN member_id DROP NOT NULL;

ALTER TABLE loan_payments 
  ALTER COLUMN member_id DROP NOT NULL;

ALTER TABLE monthly_loan_records 
  ALTER COLUMN member_id DROP NOT NULL;

-- Step 4: Drop indexes on member_id (keep user_id indexes)
DROP INDEX IF EXISTS idx_loans_member_id;
DROP INDEX IF EXISTS idx_loan_requests_member_id;
DROP INDEX IF EXISTS idx_loan_payments_member_id;
DROP INDEX IF EXISTS idx_monthly_loan_records_member_id;

-- Step 5: Create indexes on user_id for performance
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_requests_user_id ON loan_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_user_id ON loan_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_loan_records_user_id ON monthly_loan_records(user_id);

-- Step 6: Update trigger to populate member_id automatically for display purposes
CREATE OR REPLACE FUNCTION auto_populate_member_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically populate member_id from profiles for display purposes
  SELECT member_id INTO NEW.member_id
  FROM profiles
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
DROP TRIGGER IF EXISTS auto_populate_member_id_loans ON loans;
CREATE TRIGGER auto_populate_member_id_loans
  BEFORE INSERT OR UPDATE ON loans
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_member_id();

DROP TRIGGER IF EXISTS auto_populate_member_id_loan_requests ON loan_requests;
CREATE TRIGGER auto_populate_member_id_loan_requests
  BEFORE INSERT OR UPDATE ON loan_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_member_id();

DROP TRIGGER IF EXISTS auto_populate_member_id_loan_payments ON loan_payments;
CREATE TRIGGER auto_populate_member_id_loan_payments
  BEFORE INSERT OR UPDATE ON loan_payments
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_member_id();

DROP TRIGGER IF EXISTS auto_populate_member_id_monthly_records ON monthly_loan_records;
CREATE TRIGGER auto_populate_member_id_monthly_records
  BEFORE INSERT OR UPDATE ON monthly_loan_records
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_member_id();

-- Step 7: Backfill existing records with member_id
UPDATE loans l
SET member_id = p.member_id
FROM profiles p
WHERE l.user_id = p.id AND l.member_id IS NULL;

UPDATE loan_requests lr
SET member_id = p.member_id
FROM profiles p
WHERE lr.user_id = p.id AND lr.member_id IS NULL;

UPDATE loan_payments lp
SET member_id = p.member_id
FROM profiles p
WHERE lp.user_id = p.id AND lp.member_id IS NULL;

UPDATE monthly_loan_records mlr
SET member_id = p.member_id
FROM profiles p
WHERE mlr.user_id = p.id AND mlr.member_id IS NULL;
