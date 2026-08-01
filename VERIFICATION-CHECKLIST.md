# Opening Balance Dialog - Verification Checklist

## Issues Identified

### 1. UI Flash/Glitch (3ms display of wrong value)
- **Current behavior:** Shows 2,55,000 then corrects to 235,000
- **Root cause:** Initial state uses `original_loan_amount` (2,550,000)
- **Why it's wrong:** For month 7, opening should be previous month's closing (235,000)

### 2. ACID Violation Risk
- **Problem:** Initial state is not from database
- **Impact:** If user submits while stale value is displayed:
  - Interest calculated on 2,550,000 instead of 235,000
  - **Error magnitude:** 38,250 vs 3,525 = ₹34,725 difference
- **Isolation issue:** Race condition if multiple tabs open simultaneously

### 3. Current Logic Flow
```
Dialog opens
    ↓
Initial state set to original_loan_amount (2,55,000) ← WRONG VALUE SHOWN
    ↓
UI renders with 2,55,000
    ↓
useEffect triggers
    ↓
fetchMostRecentBalance() queries DB for previous month's remaining_balance
    ↓
Sets principalRemaining to 235,000 ← CORRECT VALUE
    ↓
UI re-renders (3ms later)
```

## Verification Steps (BEFORE Making Changes)

### Step 1: Check migration 76 was applied
```sql
-- Run in Supabase SQL Editor
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name='loan_payments' 
AND column_name='opening_balance';
```
**Expected:** 
- column_name: opening_balance
- data_type: numeric
- is_nullable: NO (or YES if trigger should populate)

### Step 2: Verify trigger exists
```sql
-- Run in Supabase SQL Editor
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname LIKE '%opening_balance%';
```
**Expected:** Should show function `ensure_opening_balance_on_insert`

### Step 3: Check data in loan_payments for V18
```sql
-- Run in Supabase SQL Editor
SELECT 
  period_key, 
  opening_balance, 
  remaining_balance, 
  interest_rate,
  amount
FROM loan_payments 
WHERE user_id = 'V18' 
ORDER BY period_key DESC 
LIMIT 10;
```
**Expected for month 7:**
- opening_balance = 235,000 (or month 6's remaining_balance)
- remaining_balance = value after this month's payments
- NOT NULL opening_balance

### Step 4: Manually trace the calculation
For V18 Month 7:
- Month 6 closing (remaining_balance) = X
- Month 7 opening (opening_balance) = X (should equal month 6 closing)
- Month 7 interest = X × 1.5 / 100 = Y

**Verify:** 235,000 × 1.5 / 100 = 3,525

### Step 5: Check if old records have opening_balance populated
```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) as with_opening_balance
FROM loan_payments 
WHERE opening_balance IS NOT NULL;

SELECT COUNT(*) as without_opening_balance
FROM loan_payments 
WHERE opening_balance IS NULL;
```
**Expected:** All records should have opening_balance (from migration 76 backfill)

### Step 6: Browser inspection during dialog open
1. Open record payment dialog for V18 Month 7
2. Open Browser DevTools → Console
3. Look for logs like: `[v0] Period: 2024-07 Opening Balance: 235000`
4. Check timing: when does it appear vs when is wrong value shown?

**Expected logs:**
```
[v0] Refreshed loan status: active
[v0] Period: 2024-07 Opening Balance: 235000 (directly from previous closing balance)
```

## Proposed Fix

### Option A: Use opening_balance column directly (RECOMMENDED)
**Location:** `components/admin/record-payment-unified-dialog.tsx` - `fetchMostRecentBalance()` function

**Change:**
```typescript
// OLD: Query previous month's remaining_balance
const { data: previousPayment } = await supabase
  .from("loan_payments")
  .select("remaining_balance")
  .eq("user_id", loan.user_id)
  .eq("period_key", previousPeriodKey)

// NEW: Query current month's opening_balance (already calculated by trigger)
const { data: currentPayment } = await supabase
  .from("loan_payments")
  .select("opening_balance")
  .eq("user_id", loan.user_id)
  .eq("period_key", selectedPeriodKey)

if (currentPayment?.opening_balance !== null) {
  setPrincipalRemaining(currentPayment.opening_balance)
} else {
  // Fallback to previous month if current doesn't exist yet
  const { data: previousPayment } = await supabase
    .from("loan_payments")
    .select("remaining_balance")
    .eq("user_id", loan.user_id)
    .eq("period_key", previousPeriodKey)
  
  if (previousPayment) {
    setPrincipalRemaining(previousPayment.remaining_balance)
  }
}
```

**Benefits:**
- Uses new column we added
- One unified source of truth
- Faster (direct query)
- Eliminates calculation logic

### Option B: Remove stale initial state
**Change:**
```typescript
// Initialize as loading state, not calculated value
const [principalRemaining, setPrincipalRemaining] = useState<number | null>(null)
const [isLoadingBalance, setIsLoadingBalance] = useState(true)

// In useEffect, set loading state
useEffect(() => {
  if (open) {
    setIsLoadingBalance(true)
    // ... fetch operations ...
    setIsLoadingBalance(false)
  }
}, [open, selectedMonth, selectedYear])

// In render, show loading indicator until value is ready
{isLoadingBalance ? <Skeleton /> : <FormFields />}
```

**Benefits:**
- Prevents flashing wrong value
- Clear loading feedback
- No race condition window

## Decision Matrix

| Aspect | Option A | Option B |
|--------|----------|----------|
| Speed | Fastest (column query) | Medium (needs loading state) |
| Accuracy | Highest (direct DB value) | High (waits for async) |
| Simplicity | Medium (need fallback logic) | Simple (clear loading) |
| ACID Compliance | Better (query-based) | Good (no stale state) |
| Recommended | ✅ YES | For critical systems |

## Implementation Order

1. ✅ Verify all checks pass (Step 1-6 above)
2. ✅ Confirm opening_balance column exists and is populated
3. 🔄 Implement Option A (use opening_balance column)
4. 🔄 Remove initial calculated state
5. 🔄 Test with V18 (should see correct 235,000 immediately)
6. 🔄 Monitor for any edge cases

## Success Criteria

After fix:
- ❌ No 3ms flash of wrong value
- ✅ Dialog shows 235,000 immediately (correct)
- ✅ No ACID isolation violation
- ✅ Interest calculated correctly: 235,000 × 1.5% = 3,525
- ✅ Works for all periods (backfilled + new)
- ✅ No performance degradation
