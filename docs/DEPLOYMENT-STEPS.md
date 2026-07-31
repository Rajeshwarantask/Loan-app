# Opening Balance Implementation — Deployment Steps

## Overview

This guide walks you through deploying the opening balance tracking system to your production database.

---

## Pre-Deployment Checklist

- [ ] You have access to Supabase dashboard
- [ ] You have SQL editor permissions in Supabase
- [ ] You've backed up your loan_payments table (optional but recommended)
- [ ] You've reviewed `/docs/OPENING-BALANCE-TRACKING.md`

---

## Step 1: Apply Schema Migration (75)

### Via Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy content from: `/scripts/75-add-opening-balance-column.sql`
4. Execute

**What it does:**
- Adds `opening_balance` column (NUMERIC, nullable)
- Creates index `idx_loan_payments_opening_balance` for performance
- Adds documentation comment

**Expected output:**
```
CREATE INDEX
```

### Verification:
```sql
-- Run this to verify column was added
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'loan_payments' AND column_name = 'opening_balance';

-- Expected result: opening_balance | numeric
```

---

## Step 2: Apply Data Migration (76)

### Via Supabase SQL Editor:

1. Create new query
2. Copy content from: `/scripts/76-populate-opening-balance-existing-records.sql`
3. Execute

**What it does:**
- Backfills all existing payment records with opening_balance values
- Creates trigger function `ensure_opening_balance_on_insert()`
- Creates trigger `trg_ensure_opening_balance_on_insert`
- Converts column to NOT NULL for data integrity

**This is the critical step** — runs `get_opening_balance()` for every existing record.

**Expected output:**
```
UPDATE [number of records]
CREATE FUNCTION
CREATE TRIGGER
ALTER TABLE
```

### Verification (Wait 30-60 seconds for migration to complete):
```sql
-- Check if backfill is complete
SELECT COUNT(*) as total_records FROM loan_payments;
SELECT COUNT(*) as missing_values FROM loan_payments WHERE opening_balance IS NULL;

-- Second query should return 0
```

If you see any NULL values:
```sql
-- Run manual update to catch any missed records
UPDATE loan_payments
SET opening_balance = get_opening_balance(user_id, period_key)
WHERE opening_balance IS NULL;
```

---

## Step 3: Test with New Payment

### In your app:

1. Navigate to Loans page
2. Click "Record Payment" for any user
3. Fill in payment details
4. Submit

### In Supabase SQL Editor:

```sql
-- Verify the new payment has opening_balance populated
SELECT 
  period_key, 
  opening_balance, 
  monthly_emi,
  interest_paid,
  created_at
FROM loan_payments
WHERE period_key = CURRENT_DATE::TEXT
ORDER BY created_at DESC
LIMIT 1;

-- Should show opening_balance with a numeric value (not NULL)
```

---

## Step 4: Verify Data Integrity

### Check 1: All records have opening_balance
```sql
SELECT 
  COUNT(*) as total,
  COUNT(opening_balance) as with_opening_balance,
  COUNT(*) - COUNT(opening_balance) as missing
FROM loan_payments;

-- Expected: missing = 0
```

### Check 2: Opening balances are reasonable
```sql
-- Spot check a user's progression
SELECT 
  period_key,
  opening_balance,
  monthly_emi,
  remaining_balance,
  (opening_balance - remaining_balance - COALESCE(interest_paid, 0)) as emi_paid_check
FROM loan_payments
WHERE user_id = '[pick a user_id]'
ORDER BY period_key ASC
LIMIT 10;

-- opening_balance should decrease over time (or stay same with new loans)
```

### Check 3: Interest calculations work
```sql
-- Calculate interest for sample month
SELECT 
  period_key,
  opening_balance,
  1.5 as interest_rate_percent,
  (opening_balance * 1.5 / 100) as calculated_interest_due,
  interest_paid,
  CASE 
    WHEN (opening_balance * 1.5 / 100) > interest_paid THEN penalty
    ELSE 0
  END as penalty_flag
FROM loan_payments
WHERE period_key = '2024-07'
LIMIT 5;
```

---

## Step 5: Monitor for Issues

### Monitor Opening Balance NULL values (should never appear)
```sql
-- This should always return 0 after migration
SELECT COUNT(*) FROM loan_payments WHERE opening_balance IS NULL;
```

### Monitor for unusual opening balances
```sql
-- Find records where opening_balance is suspiciously 0 or very high
SELECT 
  period_key,
  user_id,
  opening_balance,
  monthly_emi,
  remaining_balance
FROM loan_payments
WHERE opening_balance = 0
  OR opening_balance > 1000000
ORDER BY created_at DESC
LIMIT 20;

-- Review if these are legitimate
```

---

## Rollback Plan (If Needed)

If something goes wrong, you can roll back:

```sql
-- Remove trigger
DROP TRIGGER IF EXISTS trg_ensure_opening_balance_on_insert ON loan_payments;
DROP FUNCTION IF EXISTS ensure_opening_balance_on_insert();

-- Remove index
DROP INDEX IF EXISTS idx_loan_payments_opening_balance;

-- Remove column (WARNING: This deletes data!)
ALTER TABLE loan_payments DROP COLUMN opening_balance;
```

**Then re-apply migrations after fixing the issue.**

---

## Next Steps After Deployment

### 1. Update Application Code
- Code changes are already in place:
  - `/app/api/payments/route.ts` — Sends opening_balance to API
  - `/components/admin/record-payment-unified-dialog.tsx` — Captures opening_balance on payment

### 2. Test Full Flow
- Record payment for multiple users
- Verify opening_balance is populated for each
- Check unpaid interest tracking via penalty column

### 3. Optional UI Enhancements
- Add dashboard card showing "Outstanding Interest by Month"
- Create settlement flow to let users settle past month interest
- Generate monthly reports with opening_balance breakdown

### 4. Monitor Production
- First week: Check every new payment has opening_balance
- Watch for any NULL values appearing
- Monitor API error logs for RPC failures

---

## Troubleshooting

### Issue: "Column already exists"
**Solution:** Column may already exist if migrations were partially applied
```sql
-- Check if column exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'loan_payments' 
  AND column_name = 'opening_balance'
);
-- If true, skip migration 75
```

### Issue: Backfill taking too long
**Solution:** If you have many records, backfill might be slow
```sql
-- Monitor progress
SELECT 
  COUNT(*) as total,
  COUNT(opening_balance) as filled
FROM loan_payments;

-- Cancel if needed with Ctrl+C in Supabase editor
-- Then try again with fewer records at a time
```

### Issue: "function get_opening_balance does not exist"
**Solution:** Function must be created from migration 74
```sql
-- Verify function exists
SELECT EXISTS (
  SELECT 1 FROM pg_functions 
  WHERE proname = 'get_opening_balance'
);

-- If false, check if migration 74 was applied
```

### Issue: New payments not getting opening_balance
**Solution:** Trigger may not have fired
```sql
-- Verify trigger exists
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'loan_payments';

-- Should see: trg_ensure_opening_balance_on_insert
```

---

## Success Criteria

✅ All existing payment records have opening_balance populated  
✅ No NULL values in opening_balance column  
✅ New payments automatically get opening_balance on save  
✅ Interest calculations work: `interest = opening_balance × rate / 100`  
✅ Unpaid interest tracking via penalty column works  
✅ Application code properly sends/receives opening_balance  

---

## Estimated Time

- **Step 1 (Schema):** 30 seconds
- **Step 2 (Data backfill):** 1-5 minutes (depends on record count)
- **Step 3-4 (Testing):** 5-10 minutes
- **Total:** ~15 minutes

---

## Support

If you encounter issues:

1. Check `/docs/OPENING-BALANCE-TRACKING.md` for detailed architecture
2. Review `/docs/OPENING-BALANCE-QUICK-REFERENCE.md` for quick answers
3. Check logs: Supabase → SQL Editor → Recent queries
4. Verify all 4 files were modified correctly:
   - `scripts/75-add-opening-balance-column.sql`
   - `scripts/76-populate-opening-balance-existing-records.sql`
   - `app/api/payments/route.ts`
   - `components/admin/record-payment-unified-dialog.tsx`
