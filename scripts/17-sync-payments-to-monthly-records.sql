-- Script to sync loan_payments to monthly_loan_records
-- This ensures that when payments are recorded, the monthly records are updated automatically

-- Drop existing functions and triggers
DROP TRIGGER IF EXISTS sync_payment_to_monthly_record ON loan_payments;
DROP FUNCTION IF EXISTS sync_payment_to_monthly_record() CASCADE;
DROP FUNCTION IF EXISTS sync_payment_to_monthly_record_backfill(loan_payments) CASCADE;

-- Create helper function for backfilling FIRST before it's used
CREATE OR REPLACE FUNCTION sync_payment_to_monthly_record_backfill(payment_rec loan_payments)
RETURNS VOID AS $$
DECLARE
    v_month_year TEXT;
    v_month_num INT;
    v_year_num INT;
BEGIN
    v_month_num := EXTRACT(MONTH FROM payment_rec.payment_date);
    v_year_num := EXTRACT(YEAR FROM payment_rec.payment_date);
    v_month_year := TO_CHAR(payment_rec.payment_date, 'YYYY-MM');
    
    UPDATE monthly_loan_records
    SET 
        principal_paid = COALESCE(principal_paid, 0) + COALESCE(payment_rec.principal_paid, 0),
        interest_paid = COALESCE(interest_paid, 0) + COALESCE(payment_rec.interest_paid, 0),
        total_monthly_income = COALESCE(monthly_subscription, 0) + 
                              COALESCE(interest_paid, 0) + COALESCE(payment_rec.interest_paid, 0) +
                              COALESCE(principal_paid, 0) + COALESCE(payment_rec.principal_paid, 0),
        closing_outstanding = opening_outstanding + COALESCE(new_loan_taken, 0) - 
                             (COALESCE(principal_paid, 0) + COALESCE(payment_rec.principal_paid, 0)),
        updated_at = NOW()
    WHERE user_id = payment_rec.user_id
    AND month_year = v_month_year;
END;
$$ LANGUAGE plpgsql;

-- Create function to sync payments to monthly_loan_records
CREATE OR REPLACE FUNCTION sync_payment_to_monthly_record()
RETURNS TRIGGER AS $$
DECLARE
    v_month_year TEXT;
    v_month_num INT;
    v_year_num INT;
    v_record_exists BOOLEAN;
BEGIN
    -- Extract month and year from payment_date
    v_month_num := EXTRACT(MONTH FROM NEW.payment_date);
    v_year_num := EXTRACT(YEAR FROM NEW.payment_date);
    v_month_year := TO_CHAR(NEW.payment_date, 'YYYY-MM');
    
    -- Check if monthly record exists for this user and month
    SELECT EXISTS (
        SELECT 1 FROM monthly_loan_records
        WHERE user_id = NEW.user_id
        AND month_year = v_month_year
    ) INTO v_record_exists;
    
    -- If record doesn't exist, create it
    IF NOT v_record_exists THEN
        -- Get opening balance from loans table
        INSERT INTO monthly_loan_records (
            user_id,
            month_year,
            month_number,
            year_number,
            opening_outstanding,
            monthly_subscription,
            interest_calculated,
            interest_paid,
            principal_paid,
            new_loan_taken,
            penalty,
            closing_outstanding,
            total_monthly_income,
            is_draft,
            status,
            created_at,
            updated_at
        )
        SELECT 
            NEW.user_id,
            v_month_year,
            v_month_num,
            v_year_num,
            COALESCE(l.principal_remaining, l.amount) + COALESCE(NEW.principal_paid, 0), -- Opening was current + what was just paid
            COALESCE(p.monthly_subscription, 2100),
            ROUND((COALESCE(l.principal_remaining, l.amount) + COALESCE(NEW.principal_paid, 0)) * COALESCE(l.interest_rate, 1.5) / 100),
            COALESCE(NEW.interest_paid, 0),
            COALESCE(NEW.principal_paid, 0),
            0,
            0,
            COALESCE(l.principal_remaining, l.amount),
            COALESCE(p.monthly_subscription, 2100) + COALESCE(NEW.interest_paid, 0) + COALESCE(NEW.principal_paid, 0),
            true,
            'draft',
            NOW(),
            NOW()
        FROM loans l
        LEFT JOIN profiles p ON p.id = NEW.user_id
        WHERE l.id = NEW.loan_id
        LIMIT 1;
    ELSE
        -- Update existing record
        UPDATE monthly_loan_records
        SET 
            principal_paid = COALESCE(principal_paid, 0) + COALESCE(NEW.principal_paid, 0),
            interest_paid = COALESCE(interest_paid, 0) + COALESCE(NEW.interest_paid, 0),
            total_monthly_income = COALESCE(monthly_subscription, 0) + 
                                  COALESCE(interest_paid, 0) + COALESCE(NEW.interest_paid, 0) +
                                  COALESCE(principal_paid, 0) + COALESCE(NEW.principal_paid, 0),
            closing_outstanding = opening_outstanding + COALESCE(new_loan_taken, 0) - 
                                 (COALESCE(principal_paid, 0) + COALESCE(NEW.principal_paid, 0)),
            updated_at = NOW()
        WHERE user_id = NEW.user_id
        AND month_year = v_month_year;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER sync_payment_to_monthly_record
AFTER INSERT ON loan_payments
FOR EACH ROW
EXECUTE FUNCTION sync_payment_to_monthly_record();

-- Backfill existing payments for December 2025
DO $$
DECLARE
    payment_rec loan_payments%ROWTYPE;
BEGIN
    FOR payment_rec IN 
        SELECT * FROM loan_payments 
        WHERE payment_date >= '2025-12-01' 
        AND payment_date < '2026-01-01'
        ORDER BY payment_date
    LOOP
        -- Manually trigger the sync for existing payments
        PERFORM sync_payment_to_monthly_record_backfill(payment_rec);
    END LOOP;
END $$;

COMMENT ON FUNCTION sync_payment_to_monthly_record IS 'Automatically syncs loan_payments to monthly_loan_records when payments are recorded';
COMMENT ON FUNCTION sync_payment_to_monthly_record_backfill IS 'Helper function to backfill existing payments into monthly_loan_records';
