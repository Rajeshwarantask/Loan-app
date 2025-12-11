-- Fix sync_payment_to_monthly_record trigger to include all required NOT NULL columns

DROP TRIGGER IF EXISTS sync_payment_to_monthly_record ON loan_payments CASCADE;
DROP TRIGGER IF EXISTS trg_sync_payment_to_monthly_records ON loan_payments CASCADE;
DROP FUNCTION IF EXISTS sync_payment_to_monthly_record() CASCADE;
DROP FUNCTION IF EXISTS sync_payment_to_monthly_records() CASCADE;

-- Create updated function with all required columns
CREATE OR REPLACE FUNCTION sync_payment_to_monthly_record()
RETURNS TRIGGER AS $$
DECLARE
    v_month_year TEXT;
    v_month_num INT;
    v_year_num INT;
    v_period_key TEXT;
    v_record_exists BOOLEAN;
    v_member_id TEXT;
BEGIN
    -- Extract month and year from payment_date
    v_month_num := EXTRACT(MONTH FROM NEW.payment_date);
    v_year_num := EXTRACT(YEAR FROM NEW.payment_date);
    v_month_year := TO_CHAR(NEW.payment_date, 'YYYY-MM');
    v_period_key := v_year_num || '-' || LPAD(v_month_num::TEXT, 2, '0');
    
    -- Get member_id from profiles
    SELECT member_id INTO v_member_id FROM profiles WHERE id = NEW.user_id;
    
    -- Check if monthly record exists for this user and month
    SELECT EXISTS (
        SELECT 1 FROM monthly_loan_records
        WHERE user_id = NEW.user_id
        AND month_year = v_month_year
    ) INTO v_record_exists;
    
    -- If record doesn't exist, create it with all required fields
    IF NOT v_record_exists THEN
        INSERT INTO monthly_loan_records (
            user_id,
            month_year,
            period_key,
            period_year,
            period_month,
            month_number,
            year_number,
            opening_outstanding,
            monthly_subscription,
            interest_due,
            interest_paid,
            principal_paid,
            new_loan_taken,
            penalty,
            closing_outstanding,
            total_monthly_income,
            status,
            created_at,
            updated_at
        )
        SELECT 
            NEW.user_id,
            v_month_year,
            v_period_key,
            v_year_num,
            v_month_num,
            v_month_num,
            v_year_num,
            COALESCE(l.principal_remaining, l.amount) + COALESCE(NEW.principal_paid, 0),
            COALESCE(p.monthly_subscription, 2100),
            ROUND((COALESCE(l.principal_remaining, l.amount) + COALESCE(NEW.principal_paid, 0)) * COALESCE(l.interest_rate, 1.5) / 100),
            COALESCE(NEW.interest_paid, 0),
            COALESCE(NEW.principal_paid, 0),
            0,
            COALESCE(NEW.penalty_component, 0),
            COALESCE(l.principal_remaining, l.amount),
            COALESCE(p.monthly_subscription, 2100) + COALESCE(NEW.interest_paid, 0) + COALESCE(NEW.principal_paid, 0),
            'open',
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
            penalty = COALESCE(penalty, 0) + COALESCE(NEW.penalty_component, 0),
            total_monthly_income = COALESCE(monthly_subscription, 0) + 
                                  COALESCE(interest_paid, 0) + COALESCE(NEW.interest_paid, 0) +
                                  COALESCE(principal_paid, 0) + COALESCE(NEW.principal_paid, 0) +
                                  COALESCE(penalty, 0) + COALESCE(NEW.penalty_component, 0),
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

COMMENT ON FUNCTION sync_payment_to_monthly_record IS 'Automatically syncs loan_payments to monthly_loan_records with all required columns';
