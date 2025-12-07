-- This script will be used to seed initial data for testing
-- Note: Run this after creating at least one admin user through the signup flow

-- Insert sample community fund data
INSERT INTO public.community_fund (month_year, total_contributions, total_loans_issued, total_interest_collected, available_balance)
VALUES 
  ('2024-01', 60000, 40000, 3000, 23000),
  ('2024-02', 60000, 35000, 3500, 25500),
  ('2024-03', 60000, 30000, 4000, 34000)
ON CONFLICT (month_year) DO NOTHING;

-- Insert sample notices (will need to update created_by with actual admin UUID)
-- Uncomment and update the UUID after creating an admin user
-- INSERT INTO public.notices (title, content, created_by, priority)
-- VALUES 
--   ('Welcome to Community Fund', 'Welcome to our loan tracking system. Please ensure timely payments.', 'ADMIN_UUID_HERE', 'high'),
--   ('Monthly Contribution Reminder', 'Please make your monthly contribution by the 5th of each month.', 'ADMIN_UUID_HERE', 'medium');
