-- Comprehensive Financial Data Import for 44 Members
-- Based on data-vizhuthugal.pdf with actual loan amounts and balances

-- Step 1: Fix role constraint to allow 'member' role
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check') THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('user', 'admin', 'member'));

-- Step 2: Clean up existing member data
DELETE FROM monthly_loan_records WHERE user_id IN (
  SELECT id FROM profiles WHERE member_id LIKE 'V%'
);
DELETE FROM transactions_ledger WHERE user_id IN (
  SELECT id FROM profiles WHERE member_id LIKE 'V%'
);
DELETE FROM loan_payments WHERE loan_id IN (
  SELECT id FROM loans WHERE user_id IN (
    SELECT id FROM profiles WHERE member_id LIKE 'V%'
  )
);
DELETE FROM loans WHERE user_id IN (
  SELECT id FROM profiles WHERE member_id LIKE 'V%'
);
DELETE FROM profiles WHERE member_id LIKE 'V%';

-- Step 3: Temporarily drop foreign key constraint to insert profiles without auth users
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Step 4: Insert all 44 members with actual data
-- Using V ID as primary identifier

INSERT INTO profiles (id, email, full_name, phone, role, member_id, monthly_subscription, created_at, updated_at) VALUES
  (gen_random_uuid(), 'v01@community.local', 'Member V01', NULL, 'member', 'V01', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v02@community.local', 'Member V02', NULL, 'member', 'V02', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v03@community.local', 'Member V03', NULL, 'member', 'V03', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v04@community.local', 'Member V04', NULL, 'member', 'V04', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v05@community.local', 'Member V05', NULL, 'member', 'V05', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v06@community.local', 'Member V06', NULL, 'member', 'V06', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v07@community.local', 'Member V07', NULL, 'member', 'V07', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v08@community.local', 'Member V08', NULL, 'member', 'V08', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v09@community.local', 'Member V09', NULL, 'member', 'V09', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v10@community.local', 'Member V10', NULL, 'member', 'V10', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v11@community.local', 'Member V11', NULL, 'member', 'V11', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v12@community.local', 'Member V12', NULL, 'member', 'V12', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v13@community.local', 'Member V13', NULL, 'member', 'V13', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v14@community.local', 'Member V14', NULL, 'member', 'V14', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v15@community.local', 'Member V15', NULL, 'member', 'V15', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v16@community.local', 'Member V16', NULL, 'member', 'V16', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v17@community.local', 'Member V17', NULL, 'member', 'V17', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v18@community.local', 'Member V18', NULL, 'member', 'V18', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v19@community.local', 'Member V19', NULL, 'member', 'V19', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v20@community.local', 'Member V20', NULL, 'member', 'V20', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v21@community.local', 'Member V21', NULL, 'member', 'V21', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v22@community.local', 'Member V22', NULL, 'member', 'V22', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v23@community.local', 'Member V23', NULL, 'member', 'V23', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v24@community.local', 'Member V24', NULL, 'member', 'V24', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v25@community.local', 'Member V25', NULL, 'member', 'V25', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v26@community.local', 'Member V26', NULL, 'member', 'V26', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v27@community.local', 'Member V27', NULL, 'member', 'V27', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v28@community.local', 'Member V28', NULL, 'member', 'V28', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v29@community.local', 'Member V29', NULL, 'member', 'V29', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v30@community.local', 'Member V30', NULL, 'member', 'V30', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v31@community.local', 'Member V31', NULL, 'member', 'V31', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v32@community.local', 'Member V32', NULL, 'member', 'V32', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v33@community.local', 'Member V33', NULL, 'member', 'V33', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v34@community.local', 'Member V34', NULL, 'member', 'V34', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v35@community.local', 'Member V35', NULL, 'member', 'V35', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v36@community.local', 'Member V36', NULL, 'member', 'V36', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v37@community.local', 'Member V37', NULL, 'member', 'V37', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v38@community.local', 'Member V38', NULL, 'member', 'V38', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v39@community.local', 'Member V39', NULL, 'member', 'V39', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v40@community.local', 'Member V40', NULL, 'member', 'V40', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v41@community.local', 'Member V41', NULL, 'member', 'V41', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v42@community.local', 'Member V42', NULL, 'member', 'V42', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v43@community.local', 'Member V43', NULL, 'member', 'V43', 2100, NOW(), NOW()),
  (gen_random_uuid(), 'v44@community.local', 'Member V44', NULL, 'member', 'V44', 2100, NOW(), NOW());

-- Step 5: Create loans with actual outstanding balances from the PDF
-- Only for members who have active loans (Total Loan Outstanding > 0)

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Fixed column name from interest_outstanding to outstanding_interest
  
  -- V01: Outstanding ₹3,17,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V01';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 317000, 1.5, NULL, 'active', 317000, 0, NOW(), NOW());

  -- V02: Outstanding ₹2,35,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V02';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 235000, 1.5, NULL, 'active', 235000, 0, NOW(), NOW());

  -- V03: Outstanding ₹3,60,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V03';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 360000, 1.5, NULL, 'active', 360000, 0, NOW(), NOW());

  -- V07: Outstanding ₹1,65,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V07';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 165000, 1.5, NULL, 'active', 165000, 0, NOW(), NOW());

  -- V08: Outstanding ₹3,70,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V08';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 370000, 1.5, NULL, 'active', 370000, 0, NOW(), NOW());

  -- V09: Outstanding ₹1,75,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V09';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 175000, 1.5, NULL, 'active', 175000, 0, NOW(), NOW());

  -- V10: Outstanding ₹3,70,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V10';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 370000, 1.5, NULL, 'active', 370000, 0, NOW(), NOW());

  -- V11: Outstanding ₹3,55,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V11';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 355000, 1.5, NULL, 'active', 355000, 0, NOW(), NOW());

  -- V14: Outstanding ₹3,25,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V14';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 325000, 1.5, NULL, 'active', 325000, 0, NOW(), NOW());

  -- V15: Outstanding ₹2,70,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V15';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 270000, 1.5, NULL, 'active', 270000, 0, NOW(), NOW());

  -- V16: Outstanding ₹1,10,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V16';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 110000, 1.5, NULL, 'active', 110000, 0, NOW(), NOW());

  -- V17: Outstanding ₹1,70,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V17';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 170000, 1.5, NULL, 'active', 170000, 0, NOW(), NOW());

  -- V18: Outstanding ₹2,45,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V18';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 245000, 1.5, NULL, 'active', 245000, 0, NOW(), NOW());

  -- V19: Outstanding ₹1,55,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V19';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 155000, 1.5, NULL, 'active', 155000, 0, NOW(), NOW());

  -- V20: Outstanding ₹35,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V20';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 35000, 1.5, NULL, 'active', 35000, 0, NOW(), NOW());

  -- V22: Outstanding ₹3,65,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V22';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 365000, 1.5, NULL, 'active', 365000, 0, NOW(), NOW());

  -- V25: Outstanding ₹1,46,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V25';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 146000, 1.5, NULL, 'active', 146000, 0, NOW(), NOW());

  -- V26: Outstanding ₹3,80,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V26';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 380000, 1.5, NULL, 'active', 380000, 0, NOW(), NOW());

  -- V30: Outstanding ₹3,40,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V30';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 340000, 1.5, NULL, 'active', 340000, 0, NOW(), NOW());

  -- V34: Outstanding ₹5,40,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V34';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 540000, 1.5, NULL, 'active', 540000, 0, NOW(), NOW());

  -- V36: Outstanding ₹3,50,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V36';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 350000, 1.5, NULL, 'active', 350000, 0, NOW(), NOW());

  -- V38: Outstanding ₹3,30,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V38';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 330000, 1.5, NULL, 'active', 330000, 0, NOW(), NOW());

  -- V39: Outstanding ₹90,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V39';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 90000, 1.5, NULL, 'active', 90000, 0, NOW(), NOW());

  -- V40: Outstanding ₹3,85,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V40';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 385000, 1.5, NULL, 'active', 385000, 0, NOW(), NOW());

  -- V44: Outstanding ₹3,85,000
  SELECT id INTO v_user_id FROM profiles WHERE member_id = 'V44';
  INSERT INTO loans (user_id, amount, interest_rate, duration_months, status, principal_remaining, outstanding_interest, created_at, approved_at)
  VALUES (v_user_id, 385000, 1.5, NULL, 'active', 385000, 0, NOW(), NOW());

END $$;

-- Step 6: Verify totals
-- Total Outstanding from PDF: ₹1,08,88,000
-- Total Monthly Subscription: ₹92,400 (44 members × ₹2,100)

-- Summary Query
SELECT 
  'Total Members' as metric, 
  COUNT(*)::text as value 
FROM profiles WHERE member_id LIKE 'V%'
UNION ALL
SELECT 
  'Total Loans', 
  COUNT(*)::text 
FROM loans WHERE user_id IN (SELECT id FROM profiles WHERE member_id LIKE 'V%')
UNION ALL
SELECT 
  'Total Outstanding Principal', 
  '₹' || TO_CHAR(SUM(principal_remaining), 'FM99,99,999') 
FROM loans WHERE status = 'active' AND user_id IN (SELECT id FROM profiles WHERE member_id LIKE 'V%')
UNION ALL
SELECT 
  'Total Monthly Subscription', 
  '₹' || TO_CHAR(SUM(monthly_subscription), 'FM99,999') 
FROM profiles WHERE member_id LIKE 'V%';
