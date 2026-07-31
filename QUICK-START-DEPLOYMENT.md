# QUICK START: Opening Balance Deployment

## The Problem

You got this error:
```
function get_opening_balance(uuid, text) does not exist
```

This happened because migration 76 tried to use a function that doesn't exist yet.

---

## The Solution

**You need to run ONE simple SQL file that does everything:**

### Copy This → Paste in Supabase → Execute

**File:** `/vercel/share/v0-project/DEPLOY-STANDALONE.sql`

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **"New Query"**
3. Open `DEPLOY-STANDALONE.sql` from your project
4. Copy **ALL the SQL code**
5. Paste it in the SQL Editor
6. Click **"Execute"** or press **Ctrl+Enter**

---

## What Gets Deployed

✅ `opening_balance` column added/verified
✅ Performance index created
✅ **1000+ existing records auto-filled** (no manual work)
✅ Trigger created (all new records auto-populated)

---

## Expected Result

You should see:
```
UPDATE [number of rows updated]
CREATE INDEX
CREATE FUNCTION
CREATE TRIGGER
```

✅ **No errors** = Success!

---

## Verify It Worked

Run this verification query in Supabase SQL Editor:

```sql
SELECT COUNT(*) as records_without_opening_balance
FROM loan_payments
WHERE opening_balance IS NULL OR opening_balance = 0;
```

**Expected result:** `0` rows

---

## After Deployment

1. ✅ Existing records: Opening balance auto-filled
2. ✅ New payments: Trigger auto-populates opening_balance
3. ✅ API updated: Sends opening_balance with payments
4. ✅ Frontend updated: Records payment with opening_balance

**System is now live!**

---

## What Was Fixed

- **Migration 76:** Now works independently without requiring migration 74
- **Backfill Logic:** Uses SQL subqueries instead of function call
- **Trigger Function:** Auto-calculates opening_balance for new records
- **No Manual Data Entry:** All backfilled automatically

---

## That's It!

Just run the SQL file and you're done. Everything else is already deployed.

For detailed documentation, see:
- `DEPLOY-OPENING-BALANCE.md` — Complete guide with verification steps
- `OPENING-BALANCE-SOLUTION.md` — Full technical overview
