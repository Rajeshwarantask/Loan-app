-- Fix sync_payment_to_monthly_record to include both user_id and member_id
-- The user_id is required as it's a NOT NULL column in monthly_loan_records

DROP TRIGGER IF EXISTS sync_payment_trigger ON loan_payments CASCADE;
DROP FUNCTION IF EXISTS sync_payment_to_monthly_record() CASCADE;

CREATE OR REPLACE FUNCTION sync_payment_to_monthly_record()
RETURNS TRIGGER AS $$
DECLARE
  v_period_year INT;
  v_period_month INT;
  v_month_year TEXT;
  v_period_key TEXT;
  v_month_number INT;
  v_year_number INT;
BEGIN
  -- Extract period information from payment_date
  v_period_year := EXTRACT(YEAR FROM NEW.payment_date);
  v_period_month := EXTRACT(MONTH FROM NEW.payment_date);
  v_month_year := TO_CHAR(NEW.payment_date, 'YYYY-MM');
  v_period_key := TO_CHAR(NEW.payment_date, 'YYYY-MM');
  v_month_number := v_period_month;
  v_year_number := v_period_year;

  -- Upsert monthly record with BOTH user_id and member_id
  INSERT INTO monthly_loan_records (
    user_id,        -- Required NOT NULL column
    member_id,      -- Human-readable member ID
    month_year,
    period_key,
    period_year,
    period_month,
    month_number,
    year_number,
    opening_outstanding,
    closing_outstanding,
    principal_paid,
    interest_paid,
    penalty,
    monthly_subscription,
    interest_due,
    total_monthly_income,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.user_id,    -- From payment record
    NEW.member_id,  -- From payment record
    v_month_year,
    v_period_key,
    v_period_year,
    v_period_month,
    v_month_number,
    v_year_number,
    0,
    0,
    COALESCE(NEW.principal_paid, 0),
    COALESCE(NEW.interest_paid, 0),
    COALESCE(NEW.penalty_component, 0),
    COALESCE(NEW.subscription_component, 0),
    0,
    COALESCE(NEW.amount, 0),
    'draft',
    NOW(),
    NOW()
  )
  ON CONFLICT (member_id, month_year)
  DO UPDATE SET
    principal_paid = monthly_loan_records.principal_paid + COALESCE(NEW.principal_paid, 0),
    interest_paid = monthly_loan_records.interest_paid + COALESCE(NEW.interest_paid, 0),
    penalty = monthly_loan_records.penalty + COALESCE(NEW.penalty_component, 0),
    monthly_subscription = monthly_loan_records.monthly_subscription + COALESCE(NEW.subscription_component, 0),
    total_monthly_income = monthly_loan_records.total_monthly_income + COALESCE(NEW.amount, 0),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER sync_payment_trigger
  AFTER INSERT ON loan_payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_payment_to_monthly_record();

COMMENT ON FUNCTION sync_payment_to_monthly_record IS 'Syncs loan_payments to monthly_loan_records with both user_id and member_id';
