-- Drop unnecessary columns from monthly_loan_records table
-- Keep only the columns shown in the summary sheet

ALTER TABLE monthly_loan_records
DROP COLUMN IF EXISTS finalized_by,
DROP COLUMN IF EXISTS finalized_at,
DROP COLUMN IF EXISTS locked_by,
DROP COLUMN IF EXISTS locked_at,
DROP COLUMN IF EXISTS notes,
DROP COLUMN IF EXISTS arrears_principal,
DROP COLUMN IF EXISTS arrears_interest,
DROP COLUMN IF EXISTS arrears_subscription,
DROP COLUMN IF EXISTS expected_subscription,
DROP COLUMN IF EXISTS expected_interest,
DROP COLUMN IF EXISTS payment_status,
DROP COLUMN IF EXISTS is_draft,
DROP COLUMN IF EXISTS previous_outstanding,
DROP COLUMN IF EXISTS previous_month_income,
DROP COLUMN IF EXISTS previous_total_income;

-- Rename columns to match summary sheet exactly
ALTER TABLE monthly_loan_records
RENAME COLUMN interest_calculated TO interest_due;

-- Now the table has only these columns (matching summary sheet):
-- id, user_id, month_year, month_number, year_number, created_at, updated_at, status
-- monthly_subscription (Monthly Subscription Fee)
-- total_loan_taken (Total Loan Taken)
-- previous_month_principal_received (Previous Month Principal Received)
-- new_loan_taken (New Loans Issued Last Month)
-- closing_outstanding (Total Loan Outstanding)
-- interest_due (Monthly Interest Income - what they should pay)
-- monthly_installment_income (Monthly Installment Income - actual principal paid)
-- penalty (Penalty Income)
-- previous_month_interest_income (Previous Month Interest Income)
-- total_monthly_income (Total Income Current Month)
-- previous_month_total_income (Previous Month Total Income)
-- income_difference (Difference)
-- previous_month_total_loan_outstanding (Previous Month Total Loan Outstanding)
-- available_loan_amount (Available Loan - calculated as 4 Lakh - Outstanding)
-- opening_outstanding (for calculations)
-- principal_paid (for calculations)
-- interest_paid (for calculations)
