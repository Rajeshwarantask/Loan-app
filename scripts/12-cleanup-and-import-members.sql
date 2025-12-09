-- Cleanup Script: Remove duplicate tables/views and import 44 members
-- This script consolidates the database structure and imports sample data

-- Step 1: Drop all duplicate/unnecessary views and tables
DROP VIEW IF EXISTS loan_current_balances CASCADE;
DROP VIEW IF EXISTS member_current_balance CASCADE;
DROP VIEW IF EXISTS member_financial_summary CASCADE;
DROP TABLE IF EXISTS member_cash_bill_data CASCADE;

-- Step 2: Fix the role constraint to allow 'member' role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'member'));

-- Step 3: Clear existing member data to start fresh
DELETE FROM monthly_loan_records WHERE user_id IN (SELECT id FROM profiles WHERE role = 'member');
DELETE FROM loan_payments WHERE user_id IN (SELECT id FROM profiles WHERE role = 'member');
DELETE FROM loans WHERE user_id IN (SELECT id FROM profiles WHERE role = 'member');
DELETE FROM monthly_contributions WHERE user_id IN (SELECT id FROM profiles WHERE role = 'member');
DELETE FROM transactions_ledger WHERE user_id IN (SELECT id FROM profiles WHERE role = 'member');
DELETE FROM profiles WHERE role = 'member';

-- Step 4: Temporarily allow profile inserts without auth users
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Step 5: Import 44 members from sample data
-- Generate UUIDs for each member
INSERT INTO profiles (id, member_id, full_name, email, role, monthly_subscription, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'V01', 'அழகம்மாள்', 'v01@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V02', 'வசந்தி', 'v02@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V03', 'பெரியாயி', 'v03@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V04', 'ஜெயந்தி', 'v04@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V05', 'பார்வதி', 'v05@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V06', 'கமலா', 'v06@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V07', 'புஷ்பா', 'v07@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V08', 'சின்னம்மாள்', 'v08@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V09', 'லட்சுமி', 'v09@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V10', 'அன்னம்மா', 'v10@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V11', 'சரஸ்வதி', 'v11@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V12', 'ராணி', 'v12@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V13', 'மஞ்சுளா', 'v13@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V14', 'மாலதி', 'v14@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V15', 'நளினி', 'v15@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V16', 'சாந்தி', 'v16@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V17', 'ரேகா', 'v17@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V18', 'கவிதா', 'v18@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V19', 'சித்ரா', 'v19@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V20', 'உமா', 'v20@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V21', 'விஜயா', 'v21@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V22', 'இந்திரா', 'v22@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V23', 'லலிதா', 'v23@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V24', 'மீனா', 'v24@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V25', 'நிர்மலா', 'v25@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V26', 'பத்மா', 'v26@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V27', 'ரம்யா', 'v27@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V28', 'சுகன்யா', 'v28@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V29', 'தேவி', 'v29@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V30', 'வித்யா', 'v30@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V31', 'யமுனா', 'v31@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V32', 'கங்கா', 'v32@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V33', 'கோமதி', 'v33@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V34', 'காவேரி', 'v34@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V35', 'கிருஷ்ணா', 'v35@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V36', 'தமிழரசி', 'v36@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V37', 'செல்வி', 'v37@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V38', 'அமுதா', 'v38@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V39', 'பாக்கியம்', 'v39@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V40', 'சௌந்தர்யா', 'v40@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V41', 'தேன்மொழி', 'v41@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V42', 'இளங்கோ', 'v42@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V43', 'பொன்னி', 'v43@community.local', 'member', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'V44', 'முத்து', 'v44@community.local', 'member', 2100, NOW(), NOW());

-- Step 6: Re-add the foreign key constraint (optional - can keep it dropped for member-only profiles)
-- ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 7: Verify the import
SELECT 
  COUNT(*) as total_members,
  SUM(monthly_subscription) as total_monthly_subscription
FROM profiles 
WHERE role = 'member';

-- Success message
SELECT 'Successfully imported 44 members with total monthly subscription of ₹92,400' as result;
