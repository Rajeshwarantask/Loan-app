-- Add admin_remark and approved_amount columns to loan_requests table
ALTER TABLE public.loan_requests 
ADD COLUMN IF NOT EXISTS admin_remark TEXT,
ADD COLUMN IF NOT EXISTS approved_amount DECIMAL(10, 2);

-- Update existing approved requests to have approved_amount same as requested amount
UPDATE public.loan_requests 
SET approved_amount = amount 
WHERE status = 'approved' AND approved_amount IS NULL;
