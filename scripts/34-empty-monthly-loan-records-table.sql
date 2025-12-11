-- Empty the monthly_loan_records table completely
-- Remove all rows and columns, ready for redesign

-- Drop all dependent triggers and functions first
DROP TRIGGER IF EXISTS sync_payment_to_monthly_record_trigger ON loan_payments CASCADE;
DROP FUNCTION IF EXISTS sync_payment_to_monthly_record() CASCADE;
DROP FUNCTION IF EXISTS initialize_new_month(integer, integer) CASCADE;

-- Drop and recreate the table with minimal structure
DROP TABLE IF EXISTS monthly_loan_records CASCADE;

CREATE TABLE monthly_loan_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Re-enable RLS (policies will be added after columns are defined)
ALTER TABLE monthly_loan_records ENABLE ROW LEVEL SECURITY;

-- Policies will be added later after the table structure is defined

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_monthly_loan_records_updated_at 
  BEFORE UPDATE ON monthly_loan_records 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
