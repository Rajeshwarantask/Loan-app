# Opening Balance Deployment Guide

## Quick Summary

You need to run **2 migrations** in Supabase SQL Editor to enable opening balance tracking. The column already exists in your database, we just need to populate it and set up the auto-population trigger.

---

## Prerequisites

✅ Column `loan_payments.opening_balance` already exists (verified in database)
✅ Migration 74 functions (`get_opening_balance()`, etc.) are created
✅ All code changes are deployed (API & frontend already updated)

---

## Deployment Steps

### Step 1: Apply Migration 75 (Add Column & Index)

**Location:** `scripts/75-add-opening-balance-column.sql`

**What it does:**
- Ensures `opening_balance` column exists
- Creates performance index
- Adds column documentation

**Status:** This is idempotent - safe to run multiple times

```sql
-- Copy and run this in Supabase SQL Editor
ALTER TABLE loan_payments
ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_loan_payments_opening_balance
  ON loan_payments(user_id, period_key, opening_balance);

COMMENT ON COLUMN loan_payments.opening_balance IS
  'Opening balance for this payment period. Used to calculate interest due for the period.
   Formula: interest_due = opening_balance × interest_rate / 100';
```

**Expected result:** ✅ No errors

---

### Step 2: Apply Migration 76 (Backfill Data & Create Trigger)

**Location:** `scripts/76-populate-opening-balance-existing-records.sql`

**What it does:**
- ✅ Auto-fills all 1000+ existing records with correct opening balance
- ✅ Creates trigger to auto-populate all NEW records
- ✅ Uses 3-level priority logic (Previous closing → Original loan → Reconstructed)

**Duration:** 1-5 minutes depending on data size

**Run this:**

```sql
-- Copy the entire content of scripts/76-populate-opening-balance-existing-records.sql
-- And paste it in Supabase SQL Editor
```

**Expected result:** ✅ UPDATE statement shows number of records updated (should be > 0)

---

## Verification Steps

After running both migrations, verify everything worked:

### Verify 1: Check backfill completed

```sql
-- Should return: 0 (all records have opening_balance)
SELECT COUNT(*) as records_without_opening_balance
FROM loan_payments
WHERE opening_balance IS NULL OR opening_balance = 0;
```

**Expected:** 0 rows

### Verify 2: Check trigger exists

```sql
-- Should return: 1 (trigger exists)
SELECT COUNT(*)
FROM information_schema.triggers
WHERE trigger_name = 'trg_ensure_opening_balance_on_insert'
  AND table_name = 'loan_payments';
```

**Expected:** 1 row

### Verify 3: Test new payment records

In your app, record a test payment:
1. Go to admin panel → Record Payment
2. Fill in payment details
3. Submit

Then check the database:

```sql
-- Check the latest payment has opening_balance populated
SELECT period_key, opening_balance, remaining_balance
FROM loan_payments
WHERE user_id = '[YOUR_USER_ID]'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:** opening_balance should NOT be NULL

---

## Troubleshooting

### Error: "function get_opening_balance does not exist"

**Cause:** Migration 74 hasn't been run yet

**Solution:**
1. First run the SQL from `scripts/74-implement-balance-architecture.sql` to create the functions
2. Then run migration 76

### Error: "column opening_balance already exists"

**Cause:** Migration 75 already ran

**Solution:** This is OK! The `IF NOT EXISTS` clause makes it safe. Just continue to migration 76.

### Data doesn't look right

Run this verification query:

```sql
-- See opening_balance values for a specific user
SELECT 
  period_key,
  opening_balance,
  remaining_balance,
  interest_paid,
  penalty,
  created_at
FROM loan_payments
WHERE user_id = '[USER_ID]'
ORDER BY period_year, period_month ASC;
```

**What to look for:**
- opening_balance should decrease slightly month-to-month (as EMI is paid)
- opening_balance for next month should match previous month's remaining_balance
- penalty should be > 0 only when interest_paid < required interest

---

## What Happens After Deployment

### Old Records (Before Deployment)
- Opening balance auto-filled using 3-level priority logic
- No manual data entry needed
- All 1000+ records populated in 1-5 minutes

### New Records (After Deployment)
- Trigger automatically calculates opening_balance when payment is recorded
- API sends user_id and period_key
- Trigger fills in the value
- Never NULL

---

## Data Backfill Logic

For each existing payment record, opening_balance is calculated with this priority:

1. **Previous Month's Closing Balance** (most accurate)
   ```
   Previous Closing = Previous Period's remaining_balance
   ```

2. **Original Loan Amount** (if first month)
   ```
   Original Loan = loans.original_loan_amount
   ```

3. **Reconstructed Value** (fallback)
   ```
   Reconstructed = Total Original Loans - Sum of Principal Paid Before This Period
   ```

---

## Example: How Opening Balance Flows

```
JAN 2024:
  Opening: ₹100,000 (from loans table)
  EMI: ₹8,000
  Closing: ₹92,000 (stored in remaining_balance)
  → Stored in DB: opening_balance = 100,000

FEB 2024:
  Opening: ₹92,000 (from JAN's closing balance)
  EMI: ₹8,000
  Closing: ₹84,000
  → Stored in DB: opening_balance = 92,000

MAR 2024:
  Opening: ₹84,000 (from FEB's closing balance)
  → Stored in DB: opening_balance = 84,000
```

---

## Interest Calculation

Now that opening_balance is stored, interest calculation is accurate:

```
Interest Due = opening_balance × interest_rate / 100

Example:
  Opening: ₹92,000
  Rate: 1.5% per month
  Interest Due = 92,000 × 1.5 / 100 = ₹1,380
```

---

## Unpaid Interest Tracking

When interest isn't fully paid:

```
penalty = opening_balance (stored as reference)

Query Outstanding Interest:
  SELECT period_key, penalty, (penalty * 1.5 / 100) as interest_owed
  FROM loan_payments
  WHERE user_id = ? AND penalty > 0
  ORDER BY period_key ASC;
```

---

## Next Steps After Deployment

1. ✅ Run migration 75
2. ✅ Run migration 76
3. ✅ Verify with queries above
4. ✅ Test by recording a payment in app
5. ✅ Monitor first week for any issues
6. ✅ UI features ready to use (interest tracking, unpaid interest display)

---

## Questions?

Refer to:
- `OPENING-BALANCE-SOLUTION.md` — Complete technical overview
- `docs/OPENING-BALANCE-TRACKING.md` — Full reference guide
- `docs/OPENING-BALANCE-QUICK-REFERENCE.md` — Quick lookup

All include examples, SQL queries, and troubleshooting.
