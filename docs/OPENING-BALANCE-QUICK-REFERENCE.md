# Opening Balance Tracking — Quick Reference

## TL;DR

**Problem:** Interest calculations were inaccurate because we weren't tracking opening balance for each month.

**Solution:** Added `opening_balance` column to `loan_payments` table that:
- Automatically stores the period's starting balance
- Enables accurate interest calculation: `interest = opening_balance × rate / 100`
- Tracks unpaid interest via the `penalty` column (penalty = opening_balance when underpaid)
- Backreferences previous month's closing balance for continuity

---

## Database Changes

### New Column
```sql
ALTER TABLE loan_payments ADD COLUMN opening_balance NUMERIC NOT NULL;
```

### Priority for Opening Balance

When recording a payment, opening_balance is set to:

1. **Previous month's closing balance** (if exists)
2. **Original loan amount** (if first payment)
3. **Reconstructed value** (if other data missing)

---

## Monthly Cycle Example

```
JAN: Opening = ₹100,000 → Interest Due = ₹1,500 → Closing = ₹94,000
                                                            ↓
FEB: Opening = ₹94,000  → Interest Due = ₹1,410 → Closing = ₹88,000
                                                            ↓
MAR: Opening = ₹88,000  → Interest Due = ₹1,320 → Closing = ₹82,000
```

---

## Unpaid Interest Tracking

**If user underpays interest in a month:**
- `penalty` column stores that month's opening_balance
- Example: Opening = ₹94,000, Interest Due = ₹1,410, User Paid = ₹1,000
  - penalty = 94,000 (stored for future reference)
  - Owed amount = 94,000 × 1.5% - 1,000 = ₹410

**Settling unpaid interest:**
- Query: `SELECT * FROM loan_payments WHERE penalty > 0`
- Shows all months with underpaid interest
- User can settle any past month by paying the due amount

---

## API Changes

### POST /api/payments

**Before:**
```json
{
  "loan_id": "...",
  "payment_date": "2024-07-31",
  "amount": 8000
}
```

**After:**
```json
{
  "loan_id": "...",
  "user_id": "...",
  "payment_date": "2024-07-31",
  "amount": 8000,
  "opening_balance": 94000  // ← NEW (optional, auto-calculated if missing)
}
```

If `opening_balance` not provided, API automatically calculates using `get_opening_balance()` function.

---

## Data Population

### Existing Records: AUTOMATIC
Migration script 76 backfills all existing payment records:
```sql
UPDATE loan_payments
SET opening_balance = get_opening_balance(user_id, period_key)
WHERE opening_balance IS NULL;
```

**No manual data entry needed** — system reconstructs values from existing data.

### New Records: AUTOMATIC
Trigger `trg_ensure_opening_balance_on_insert` auto-populates on insert.

---

## Key SQL Queries

### Outstanding Interest by Month
```sql
SELECT 
  period_key,
  opening_balance,
  opening_balance * 1.5 / 100 as interest_due,
  penalty
FROM loan_payments
WHERE user_id = ? AND penalty > 0
ORDER BY period_key ASC;
```

### Total Unpaid Interest
```sql
SELECT 
  SUM(opening_balance * 1.5 / 100) as total_interest_owed
FROM loan_payments
WHERE user_id = ? AND penalty > 0;
```

### Month-by-Month Balance Progression
```sql
SELECT 
  period_key,
  opening_balance,
  monthly_emi,
  interest_paid,
  remaining_balance
FROM loan_payments
WHERE user_id = ?
ORDER BY period_key ASC;
```

---

## Files Changed

| File | Changes |
|------|---------|
| `scripts/75-add-opening-balance-column.sql` | ✨ NEW: Adds column & index |
| `scripts/76-populate-opening-balance-existing-records.sql` | ✨ NEW: Backfills data + trigger |
| `app/api/payments/route.ts` | Updated: Includes opening_balance in inserts |
| `components/admin/record-payment-unified-dialog.tsx` | Updated: Sends opening_balance on payment save |
| `docs/OPENING-BALANCE-TRACKING.md` | ✨ NEW: Full documentation |

---

## Testing

### 1. Check existing records got backfilled
```sql
SELECT COUNT(*) FROM loan_payments WHERE opening_balance IS NULL;
-- Should return: 0
```

### 2. Record a new payment
- Open loans page → Record Payment
- Submit payment

### 3. Verify new record has opening_balance
```sql
SELECT period_key, opening_balance, monthly_emi 
FROM loan_payments 
WHERE period_key = '2024-07'
ORDER BY created_at DESC LIMIT 1;
```

---

## Interest Formula (For Reference)

```
Interest Due = Opening Balance × Interest Rate / 100

Example:
  Opening Balance: ₹94,000
  Interest Rate: 1.5% per month
  Interest Due: ₹94,000 × 0.015 = ₹1,410
```

---

## Penalty Column Semantics

| Scenario | Penalty Value | Meaning |
|----------|--------------|---------|
| Interest fully paid | 0 | No tracking needed |
| Interest underpaid | opening_balance | Month has unpaid interest |
| (Used to calculate) | — | Interest owed = penalty × rate / 100 |

---

## Benefits

✅ Each month's interest based on actual opening balance  
✅ Complete month-to-month balance tracking  
✅ Accurate unpaid interest identification  
✅ No manual data entry for existing or new records  
✅ Audit trail of balance progression  
✅ Support for settling past months' interest  

---

## Questions?

See `/docs/OPENING-BALANCE-TRACKING.md` for detailed documentation.
