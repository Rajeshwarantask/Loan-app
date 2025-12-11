-- Fix sync_payment_to_monthly_record function to use interest_due instead of interest_calculated

DROP TRIGGER IF EXISTS sync_payment_to_monthly_record ON loan_payments CASCADE;
DROP FUNCTION IF EXISTS sync_payment_to_monthly_record() CASCADE;

-- Recreate function with correct column name
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
        -- Use interest_due instead of interest_calculated
        INSERT INTO monthly_loan_records (
            user_id,
            month_year,
            opening_outstanding,
            monthly_subscription,
            interest_due,
            interest_paid,
            principal_paid,
            new_loan_taken,
            penalty,
            closing_outstanding,
            total_monthly_income,
            created_at,
            updated_at
        )
        SELECT 
            NEW.user_id,
            v_month_year,
            COALESCE(l.principal_remaining, l.amount) + COALESCE(NEW.principal_paid, 0),
            COALESCE(p.monthly_subscription, 2100),
            ROUND((COALESCE(l.principal_remaining, l.amount) + COALESCE(NEW.principal_paid, 0)) * COALESCE(l.interest_rate, 1.5) / 100),
            COALESCE(NEW.interest_paid, 0),
            COALESCE(NEW.principal_paid, 0),
            0,
            0,
            COALESCE(l.principal_remaining, l.amount),
            COALESCE(p.monthly_subscription, 2100) + COALESCE(NEW.interest_paid, 0) + COALESCE(NEW.principal_paid, 0),
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

-- Recreate trigger
CREATE TRIGGER sync_payment_to_monthly_record
AFTER INSERT ON loan_payments
FOR EACH ROW
EXECUTE FUNCTION sync_payment_to_monthly_record();

COMMENT ON FUNCTION sync_payment_to_monthly_record IS 'Automatically syncs loan_payments to monthly_loan_records when payments are recorded - uses interest_due column';
