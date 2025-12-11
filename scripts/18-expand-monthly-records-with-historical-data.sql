-- Script 18: Expand monthly_loan_records to include all historical tracking fields
-- This implements the comprehensive monthly tracking system from the summary sheet

-- Add new columns to monthly_loan_records for historical tracking
ALTER TABLE monthly_loan_records ADD COLUMN IF NOT EXISTS total_loan_taken NUMERIC DEFAULT 0;
ALTER TABLE monthly_loan_records ADD COLUMN IF NOT EXISTS previous_month_principal_received NUMERIC DEFAULT 0;
ALTER TABLE monthly_loan_records ADD COLUMN IF NOT EXISTS monthly_installment_income NUMERIC DEFAULT 0;
ALTER TABLE monthly_loan_records ADD COLUMN IF NOT EXISTS previous_month_interest_income NUMERIC DEFAULT 0;
ALTER TABLE monthly_loan_records ADD COLUMN IF NOT EXISTS previous_month_total_income NUMERIC DEFAULT 0;
ALTER TABLE monthly_loan_records ADD COLUMN IF NOT EXISTS previous_month_total_loan_outstanding NUMERIC DEFAULT 0;
ALTER TABLE monthly_loan_records ADD COLUMN IF NOT EXISTS income_difference NUMERIC DEFAULT 0;
ALTER TABLE monthly_loan_records ADD COLUMN IF NOT EXISTS available_loan_amount NUMERIC DEFAULT 0;

-- Add comments to explain each field
COMMENT ON COLUMN monthly_loan_records.total_loan_taken IS 'Cumulative total loan amount ever taken by member';
COMMENT ON COLUMN monthly_loan_records.previous_month_principal_received IS 'Principal payment received in previous month';
COMMENT ON COLUMN monthly_loan_records.monthly_installment_income IS 'Total installment income (principal + interest paid)';
COMMENT ON COLUMN monthly_loan_records.previous_month_interest_income IS 'Interest income from previous month';
COMMENT ON COLUMN monthly_loan_records.previous_month_total_income IS 'Total income from previous month';
COMMENT ON COLUMN monthly_loan_records.previous_month_total_loan_outstanding IS 'Total loan outstanding from previous month';
COMMENT ON COLUMN monthly_loan_records.income_difference IS 'Difference between current and previous month total income';
COMMENT ON COLUMN monthly_loan_records.available_loan_amount IS 'Available loan capacity (4 Lakh - Total Outstanding)';

-- Create or replace the initialize_new_month function with enhanced historical tracking
DROP FUNCTION IF EXISTS initialize_new_month(TEXT, UUID) CASCADE;

CREATE OR REPLACE FUNCTION initialize_new_month(
  p_month_year TEXT,  -- Format: "2025-01"
  p_created_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INTEGER;
  v_month INTEGER;
  v_count INTEGER := 0;
  v_member RECORD;
  v_prev_month_year TEXT;
  v_prev_record RECORD;
  v_total_loan_taken NUMERIC;
  v_new_loans_last_month NUMERIC;
BEGIN
  -- Parse year and month
  v_year := CAST(SPLIT_PART(p_month_year, '-', 1) AS INTEGER);
  v_month := CAST(SPLIT_PART(p_month_year, '-', 2) AS INTEGER);
  
  -- Calculate previous month
  IF v_month = 1 THEN
    v_prev_month_year := LPAD((v_year - 1)::TEXT, 4, '0') || '-12';
  ELSE
    v_prev_month_year := LPAD(v_year::TEXT, 4, '0') || '-' || LPAD((v_month - 1)::TEXT, 2, '0');
  END IF;

  -- Loop through all members
  FOR v_member IN 
    SELECT 
      p.id as user_id,
      p.member_id,
      p.monthly_subscription,
      -- Get current outstanding from active loans only
      COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.principal_remaining ELSE 0 END), 0) as current_outstanding,
      -- Get total loan amount ever taken (all loans, any status)
      COALESCE(SUM(l.amount), 0) as total_loan_ever_taken,
      -- Get new loans issued in previous month
      COALESCE(SUM(CASE 
        WHEN l.created_at >= DATE_TRUNC('month', TO_DATE(v_prev_month_year, 'YYYY-MM'))
        AND l.created_at < DATE_TRUNC('month', TO_DATE(p_month_year, 'YYYY-MM'))
        THEN l.amount 
        ELSE 0 
      END), 0) as new_loans_prev_month
    FROM profiles p
    LEFT JOIN loans l ON l.user_id = p.id
    WHERE p.role = 'member'
    GROUP BY p.id, p.member_id, p.monthly_subscription
    ORDER BY p.member_id
  LOOP
    -- Get previous month's record if exists
    SELECT 
      closing_outstanding,
      principal_paid,
      interest_paid,
      total_monthly_income,
      new_loan_taken
    INTO v_prev_record
    FROM monthly_loan_records
    WHERE user_id = v_member.user_id 
      AND month_year = v_prev_month_year
    LIMIT 1;

    -- Use total loan ever taken from all loans
    v_total_loan_taken := v_member.total_loan_ever_taken;
    
    -- Use new loans from previous month
    v_new_loans_last_month := COALESCE(v_prev_record.new_loan_taken, v_member.new_loans_prev_month);

    -- Use INSERT ... ON CONFLICT to prevent duplicate key errors
    INSERT INTO monthly_loan_records (
      user_id,
      month_year,
      year_number,
      month_number,
      opening_outstanding,
      monthly_subscription,
      interest_calculated,
      new_loan_taken,
      principal_paid,
      interest_paid,
      penalty,
      closing_outstanding,
      total_monthly_income,
      status,
      is_draft,
      -- New historical fields
      total_loan_taken,
      previous_month_principal_received,
      previous_month_interest_income,
      previous_month_total_income,
      previous_month_total_loan_outstanding,
      monthly_installment_income,
      income_difference,
      available_loan_amount,
      created_at,
      updated_at
    ) VALUES (
      v_member.user_id,
      p_month_year,
      v_year,
      v_month,
      -- Opening = previous closing OR current outstanding if no previous record
      COALESCE(v_prev_record.closing_outstanding, v_member.current_outstanding),
      v_member.monthly_subscription,
      -- Calculate 1.5% interest on opening balance
      ROUND(COALESCE(v_prev_record.closing_outstanding, v_member.current_outstanding) * 0.015, 2),
      0, -- new_loan_taken (will be updated when loans are issued)
      0, -- principal_paid (will be updated when payments recorded)
      0, -- interest_paid (will be updated when payments recorded)
      0, -- penalty (will be updated manually)
      -- Closing = opening + new - principal (initially same as opening)
      COALESCE(v_prev_record.closing_outstanding, v_member.current_outstanding),
      -- Total income = subscription initially (will grow with payments)
      v_member.monthly_subscription,
      'draft',
      true,
      -- Historical tracking fields
      v_total_loan_taken, -- Total of ALL loans ever taken
      COALESCE(v_prev_record.principal_paid, 0), -- Previous month's principal payment
      COALESCE(v_prev_record.interest_paid, 0), -- Previous month's interest payment
      COALESCE(v_prev_record.total_monthly_income, 0), -- Previous month's total income
      COALESCE(v_prev_record.closing_outstanding, v_member.current_outstanding), -- Previous month's closing
      0, -- monthly_installment_income (principal + interest paid, updated with payments)
      0, -- income_difference (will be calculated after month ends)
      400000 - COALESCE(v_prev_record.closing_outstanding, v_member.current_outstanding), -- Available loan
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id, month_year) 
    DO UPDATE SET
      updated_at = NOW();
    
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Initialized %s records for %s', v_count, p_month_year),
    'count', v_count,
    'month_year', p_month_year
  );
END;
$$;

-- Create trigger to auto-update monthly_installment_income when payments are recorded
CREATE OR REPLACE FUNCTION update_monthly_installment_income()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update monthly_installment_income = principal_paid + interest_paid
  NEW.monthly_installment_income := COALESCE(NEW.principal_paid, 0) + COALESCE(NEW.interest_paid, 0);
  
  -- Update available_loan_amount = 400000 - closing_outstanding
  NEW.available_loan_amount := 400000 - COALESCE(NEW.closing_outstanding, 0);
  
  -- Update income_difference = total_monthly_income - previous_month_total_income
  NEW.income_difference := COALESCE(NEW.total_monthly_income, 0) - COALESCE(NEW.previous_month_total_income, 0);
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_monthly_installment_income ON monthly_loan_records;
CREATE TRIGGER trigger_update_monthly_installment_income
  BEFORE INSERT OR UPDATE ON monthly_loan_records
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_installment_income();

-- Create a view for easy cash bill generation with all required fields
CREATE OR REPLACE VIEW cash_bill_data AS
SELECT 
  p.id as user_id,
  p.member_id,
  p.full_name as name,
  mlr.month_year,
  mlr.monthly_subscription,
  mlr.total_loan_taken,
  mlr.previous_month_principal_received,
  mlr.new_loan_taken as new_loans_issued_last_month,
  mlr.closing_outstanding as total_loan_outstanding,
  mlr.interest_paid as monthly_interest_income,
  mlr.monthly_installment_income,
  mlr.penalty as penalty_income,
  mlr.previous_month_interest_income,
  mlr.total_monthly_income,
  mlr.previous_month_total_income,
  mlr.income_difference as difference,
  mlr.previous_month_total_loan_outstanding,
  mlr.available_loan_amount,
  -- Cash bill specific calculations
  mlr.closing_outstanding as total_loan, -- For cash bill "Total Loan" field
  ROUND(mlr.closing_outstanding * 0.015, 2) as interest, -- 1.5% interest
  mlr.principal_paid as monthly_emi, -- EMI payment
  mlr.penalty as fine
FROM profiles p
LEFT JOIN monthly_loan_records mlr ON mlr.user_id = p.id
WHERE p.role = 'member'
ORDER BY p.member_id;

COMMENT ON VIEW cash_bill_data IS 'Consolidated view for cash bill generation with all required fields';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Schema updated successfully. Added historical tracking fields to monthly_loan_records.';
  RAISE NOTICE 'New columns: total_loan_taken, previous_month_principal_received, monthly_installment_income, etc.';
  RAISE NOTICE 'Created cash_bill_data view for easy cash bill generation.';
END $$;
