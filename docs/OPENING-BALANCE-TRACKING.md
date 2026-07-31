# Opening Balance Tracking System

## Overview

The loan payment system now tracks `opening_balance` for each period in the `loan_payments` table. This enables accurate month-by-month interest calculations and maintains a complete audit trail of how each period's balance was determined.

## Database Schema

### loan_payments Table
```sql
CREATE TABLE loan_payments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  loan_id UUID NOT NULL,
  period_key TEXT NOT NULL,        -- Format: YYYY-MM
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  opening_balance NUMERIC NOT NULL, -- NEW: Starting balance for this period
  remaining_balance NUMERIC,        -- Closing balance after this period's transactions
  interest_paid NUMERIC,           -- Interest paid this period
  monthly_emi NUMERIC,             -- EMI/principal paid this period
  additional_principal NUMERIC,     -- Extra principal payment this period
  penalty NUMERIC,                 -- Stores opening_balance if interest underpaid (for tracking)
  payment_date TIMESTAMP,
  status TEXT,
  ... other columns
);
```

## How Opening Balance is Calculated

### Priority Order (Implemented in `get_opening_balance()` function):

1. **Previous Period's Closing Balance** (Primary)
   - Most accurate and consistent approach
   - Ensures month-to-month continuity
   - Example: Jan's closing balance = Feb's opening balance

2. **Original Loan Amount** (Fallback)
   - Used when there's no prior payment record
   - Typically the first month of a new loan

3. **Reconstructed Balance** (Last Resort)
   - Calculated as: Sum of original loans - cumulative principal paid before this period
   - Used only when prior months' data is incomplete

### Example Flow

```
Month: January 2024
  Original Loan: ₹100,000
  Opening Balance: ₹100,000 (from Priority 2)
  Transactions: EMI ₹5,000, Additional Principal ₹2,000
  Closing Balance: ₹93,000

Month: February 2024
  Opening Balance: ₹93,000 (from January's closing - Priority 1)
  Transactions: EMI ₹5,000, Additional Principal ₹1,000
  Closing Balance: ₹87,000

Month: March 2024
  Opening Balance: ₹87,000 (from February's closing - Priority 1)
  ...
```

## Interest Calculation

Interest for each period is calculated as:
```
Interest Due = Opening Balance × Interest Rate / 100

Example:
  Opening Balance: ₹87,000
  Interest Rate: 1.5% per month
  Interest Due: ₹87,000 × 1.5 / 100 = ₹1,305
```

## Unpaid Interest Tracking

The `penalty` column stores the opening_balance when interest is underpaid for that month:

```sql
IF interest_paid < interest_due THEN
  penalty = opening_balance  -- Store for future reference
ELSE
  penalty = 0               -- Fully paid, no tracking needed
END IF
```

### Outstanding Interest Calculation

To calculate total outstanding interest for a user:
```sql
SELECT 
  period_key,
  opening_balance,
  opening_balance * (interest_rate / 100) as interest_due,
  penalty
FROM loan_payments
WHERE user_id = ? 
  AND penalty > 0  -- Only months with underpaid interest
ORDER BY period_key ASC;
```

## Data Population (Migration)

### Existing Records
Migration script `76-populate-opening-balance-existing-records.sql` automatically backfills all existing payment records using the `get_opening_balance()` function.

**No manual data entry required** — the system intelligently reconstructs opening balances based on available data and priority rules.

### New Records
Trigger `trg_ensure_opening_balance_on_insert` automatically populates opening_balance when new payment records are inserted via the API.

## API Integration

### Payment Recording Endpoint
When recording a payment via `/api/payments`:

```typescript
// Request payload
{
  loan_id: "...",
  user_id: "...",          // Required for auto-calculation
  payment_date: "...",
  opening_balance: 87000,  // Optional — auto-calculated if not provided
  monthly_emi: 5000,
  interest_component: 1305,
  ... other fields
}

// If opening_balance is not provided:
// 1. API calls get_opening_balance(user_id, period_key)
// 2. Uses that value if available
// 3. Falls back to 0 if calculation fails
```

## Benefits

✅ **Accurate Interest Tracking**: Each month's interest is based on actual period opening balance
✅ **Audit Trail**: Complete history of balance progression month-by-month
✅ **Automatic Calculation**: No manual data entry for existing or new records
✅ **Unpaid Interest Visibility**: Easy to query and display months with outstanding interest
✅ **Settlement Support**: Can track which periods still need interest settlement
✅ **Normalized Design**: Eliminates redundant balance storage

## Usage Examples

### Query Outstanding Interest
```sql
SELECT 
  period_key,
  opening_balance,
  (opening_balance * 1.5 / 100) as interest_due,
  penalty
FROM loan_payments
WHERE user_id = ? AND penalty > 0
ORDER BY period_key ASC;
```

### Calculate Total Accumulated Interest
```sql
SELECT 
  SUM(opening_balance * 1.5 / 100) as total_outstanding_interest
FROM loan_payments
WHERE user_id = ? AND penalty > 0;
```

### Rebuild Balance for a Month
```sql
SELECT 
  opening_balance,
  remaining_balance,
  (opening_balance - remaining_balance) as total_paid
FROM loan_payments
WHERE user_id = ? AND period_key = '2024-03';
```

## Column Relationships

```
┌─────────────────────────────────────────┐
│  Opening Balance (Start of Period)      │
│  This period's interest = OB × rate/100 │
├─────────────────────────────────────────┤
│  - EMI Payment                          │
│  - Additional Principal                 │
│  + New Loan Amount                      │
├─────────────────────────────────────────┤
│  = Remaining/Closing Balance (End)      │
│  (Becomes next period's opening balance)│
└─────────────────────────────────────────┘
```

## Troubleshooting

### Missing opening_balance values
- Run: `SELECT COUNT(*) FROM loan_payments WHERE opening_balance IS NULL;`
- If any exist, re-run migration 76 to populate

### Interest calculations seem off
- Verify `opening_balance` is correct for the period
- Check interest_rate is set in the loans table
- Confirm period_key format is YYYY-MM

### Trigger not firing on inserts
- Verify trigger `trg_ensure_opening_balance_on_insert` exists: `\d loan_payments`
- Check function `ensure_opening_balance_on_insert()` is available

## Files Modified

1. `/scripts/75-add-opening-balance-column.sql` — Adds column and index
2. `/scripts/76-populate-opening-balance-existing-records.sql` — Backfills data with trigger setup
3. `/app/api/payments/route.ts` — Includes opening_balance in inserts, auto-calculates if needed
4. `/components/admin/record-payment-unified-dialog.tsx` — Sends opening_balance when recording payments
