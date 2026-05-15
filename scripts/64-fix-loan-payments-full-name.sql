-- Fix loan_payments full_name column that has 'Unknown' values
-- Update full_name from profiles table based on user_id

UPDATE loan_payments
SET full_name = COALESCE(p.full_name, 'Unknown User')
FROM profiles p
WHERE loan_payments.user_id = p.id
  AND (loan_payments.full_name = 'Unknown' OR loan_payments.full_name IS NULL OR loan_payments.full_name = '');

-- Log the number of records updated
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM loan_payments
    WHERE full_name != 'Unknown' AND full_name IS NOT NULL;
    
    RAISE NOTICE 'Updated loan_payments full_name. Total valid records: %', updated_count;
END $$;
