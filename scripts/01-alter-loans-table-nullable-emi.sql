-- Migration: Make EMI-related columns nullable in loans table
-- These fields will be updated by admin after loan creation

ALTER TABLE loans 
  ALTER COLUMN duration_months DROP NOT NULL,
  ALTER COLUMN monthly_emi_amount DROP NOT NULL,
  ALTER COLUMN installment_duration_months DROP NOT NULL,
  ALTER COLUMN emi_monthly_interest DROP NOT NULL;

-- Add comment to document the change
COMMENT ON COLUMN loans.duration_months IS 'Duration in months - set by admin after loan approval';
COMMENT ON COLUMN loans.monthly_emi_amount IS 'Monthly EMI amount - calculated and set by admin';
COMMENT ON COLUMN loans.installment_duration_months IS 'Installment duration - set by admin';
COMMENT ON COLUMN loans.emi_monthly_interest IS 'Monthly interest for EMI - calculated by admin';
