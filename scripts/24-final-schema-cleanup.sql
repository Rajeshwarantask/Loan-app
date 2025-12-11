-- ============================================
-- FINAL SCHEMA CLEANUP
-- ============================================
-- This script cleans up redundant structures and ensures
-- the database follows the normalized design

-- Drop the redundant monthly_cycle_summary table (should be a view instead)
DROP TABLE IF EXISTS monthly_cycle_summary CASCADE;

-- Create monthly_cycle_summary as a proper VIEW
CREATE OR REPLACE VIEW monthly_cycle_summary AS
SELECT 
    mlr.id,
    mlr.user_id,
    mlr.period_key,
    mlr.period_year,
    mlr.period_month,
    mlr.month_year,
    
    -- Member information from profiles
    p.member_id,
    p.full_name,
    p.email,
    
    -- Financial data from monthly records
    mlr.monthly_subscription AS total_subscription,
    mlr.total_loan_taken,
    mlr.previous_month_principal_received,
    mlr.new_loan_taken AS new_loans_issued_last_month,
    mlr.opening_outstanding,
    mlr.closing_outstanding,
    mlr.interest_due AS monthly_interest_income,
    mlr.monthly_installment_income,
    mlr.penalty AS penalty_income,
    mlr.previous_month_interest_income,
    mlr.total_monthly_income AS total_income_current_month,
    mlr.previous_month_total_income,
    mlr.income_difference AS difference,
    mlr.previous_month_total_loan_outstanding,
    mlr.available_loan_amount AS available_loan,
    
    -- Calculated totals
    mlr.principal_paid AS total_principal_paid,
    mlr.interest_paid AS total_interest_paid,
    
    -- Metadata
    mlr.status,
    CONCAT(
        CASE mlr.period_month
            WHEN 1 THEN 'January'
            WHEN 2 THEN 'February'
            WHEN 3 THEN 'March'
            WHEN 4 THEN 'April'
            WHEN 5 THEN 'May'
            WHEN 6 THEN 'June'
            WHEN 7 THEN 'July'
            WHEN 8 THEN 'August'
            WHEN 9 THEN 'September'
            WHEN 10 THEN 'October'
            WHEN 11 THEN 'November'
            WHEN 12 THEN 'December'
        END,
        ' ',
        mlr.period_year
    ) AS month_label,
    mlr.created_at,
    mlr.updated_at
FROM 
    monthly_loan_records mlr
INNER JOIN 
    profiles p ON mlr.user_id = p.id
ORDER BY 
    p.member_id ASC;

-- Refresh materialized view if needed (comment: this is just a regular view, not materialized)
COMMENT ON VIEW monthly_cycle_summary IS 'Consolidated view of monthly loan records with member information for easy frontend consumption';
