-- Make duration_months nullable in loan_requests table since we removed it from the form
ALTER TABLE public.loan_requests 
ALTER COLUMN duration_months DROP NOT NULL;

-- Set default value to NULL for new records
ALTER TABLE public.loan_requests 
ALTER COLUMN duration_months SET DEFAULT NULL;
