# Balance Architecture - Quick Reference

## Quick Start for Developers

### Check if a Balance is Valid
```typescript
import { balanceRecoveryService } from '@/lib/utils/balance-recovery'

const balance = await balanceRecoveryService.getOpeningBalance(userId, '2024-06')
console.log('Opening balance:', balance)
```

### Record a Payment with New Architecture
```typescript
import { memberStatusService } from '@/lib/utils/member-status'
import { 
  reconstructClosingBalance,
  calculateInterestWithAccumulation 
} from '@/lib/utils/loan-calculator'

// Get opening balance (handles all priority logic automatically)
const opening = await balanceRecoveryService.getOpeningBalance(userId, periodKey)

// Check if member is subscription-only
const isSubscriptionOnly = await memberStatusService.isSubscriptionOnly(userId)

// If converting from subscription-only to active
if (isSubscriptionOnly && newLoanAmount > 0) {
  await memberStatusService.convertSubscriptionToActive(
    userId,
    loanId,
    newLoanAmount,
    opening,
    interestRate
  )
}

// Calculate closing balance using formula
const closing = reconstructClosingBalance(
  opening,
  emi,
  additionalPrincipal,
  newLoans
)

// Record payment
await supabase.from('loan_payments').insert({
  user_id: userId,
  period_key: periodKey,
  remaining_balance: closing,
  monthly_emi: emi,
  additional_principal: additionalPrincipal,
  interest_paid: interest,
  monthly_subscription: subscription,
  penalty: penalty
  // ... other fields
})
```

### Revert a Period
```typescript
import { balanceRecoveryService } from '@/lib/utils/balance-recovery'

const result = await balanceRecoveryService.revertPeriod(userId, '2024-06', adminId)
if (result.success) {
  console.log(`Reverted, new balance: ${result.restored_balance}`)
}
```

### Validate All Balances (Admin)
```typescript
import { dataIntegrityService } from '@/lib/utils/data-integrity'

const issues = await dataIntegrityService.validateAllBalances(userId)
const badPeriods = issues.filter(i => !i.is_valid)
console.log(`Found ${badPeriods.length} inconsistencies`)
```

## Formula Reference

### Opening Balance (Priority)
1. Previous period's `remaining_balance`
2. Loan's `original_loan_amount`
3. Reconstruction from history

### Closing Balance (Formula)
```
Closing = Opening - EMI - Additional Principal + New Loan Amount

Also useful for revert operations:
Opening = Closing + EMI + Additional Principal - New Loan Amount
```

### Interest Accumulation
```
Total Interest = Previous Unpaid + (Opening Balance × Rate / 100)
```

### Subscription Accumulation
```
Total Subscription = Previous Unpaid + 2100 (monthly)
```

## Utility Methods at a Glance

### `BalanceRecoveryService`
| Method | Purpose |
|--------|---------|
| `getOpeningBalance()` | Get opening balance with fallback |
| `calculateClosingBalance()` | Calculate period closing balance |
| `reconstructBalance()` | Full reconstruction with all data |
| `revertPeriod()` | Delete period payments and restore |
| `validateBalanceConsistency()` | Check balance validity |
| `syncMemberStatus()` | Sync subscription→active conversion |
| `getBalanceHistory()` | Get last N period payments |

### `MemberStatusService`
| Method | Purpose |
|--------|---------|
| `isSubscriptionOnly()` | Check member status |
| `convertSubscriptionToActive()` | Upgrade member with new loan |
| `getMemberStatus()` | Get current status |
| `getMemberLoans()` | Get all member loans |
| `ensureStatusConsistency()` | Fix inconsistencies |

### `DataIntegrityService`
| Method | Purpose |
|--------|---------|
| `validateAllBalances()` | Validate system-wide balances |
| `checkOriginalAmountPopulation()` | Check original_loan_amount |
| `fixMissingOriginalAmounts()` | Populate missing amounts |
| `findDuplicatePayments()` | Find duplicate records |
| `verifyMemberStatusConsistency()` | Check all member statuses |
| `generateReconciliationReport()` | Detailed balance report |

### Loan Calculator Functions
| Function | Purpose |
|----------|---------|
| `reconstructClosingBalance()` | Apply formula |
| `calculateInterestWithAccumulation()` | Interest with history |
| `calculateSubscriptionWithAccumulation()` | Subscription with history |
| `getPriorityBasedOpeningBalance()` | Priority-based selection |
| `calculateTotalPayment()` | Sum all components |

## Common Scenarios

### Scenario: New Loan for Subscription-Only Member
```typescript
// 1. Get opening balance
const opening = await balanceRecoveryService.getOpeningBalance(userId, '2024-07')

// 2. Convert status and add loan
await memberStatusService.convertSubscriptionToActive(
  userId, loanId, 50000, opening, 1.5
)

// 3. Calculate closing (50000 new loan goes here)
const closing = reconstructClosingBalance(opening, 5000, 0, 50000)

// 4. Record payment
// ... record in loan_payments with closing balance
```

### Scenario: Fix Missing Original Amounts (Admin)
```typescript
const integrity = new DataIntegrityService()
const issues = await integrity.checkOriginalAmountPopulation()
console.log(`${issues.unpopulatedCount} loans need fixing`)
await integrity.fixMissingOriginalAmounts()
```

### Scenario: Monthly Validation (Admin)
```typescript
const integrity = new DataIntegrityService()
const issues = await integrity.validateAllBalances()
if (issues.some(i => !i.is_valid)) {
  console.log('❌ Balances have inconsistencies')
  // Alert team for investigation
} else {
  console.log('✅ All balances consistent')
}
```

### Scenario: Revert Mistake (Admin)
```typescript
// User X payment for June 2024 was recorded incorrectly
const result = await balanceRecoveryService.revertPeriod(
  userXId,
  '2024-06',
  currentAdminId
)
// System restores balance from May 2024 or original_loan_amount
// User can now re-record correct payment for June
```

## Error Handling Pattern
```typescript
try {
  const balance = await balanceRecoveryService.getOpeningBalance(userId, periodKey)
} catch (err) {
  console.error('Balance retrieval failed:', err.message)
  // Fallback to stored balance or notify user
  return storedBalance
}
```

## Admin Panel Access
```
Path: /admin/balance-management
- Validate Tab: Check system integrity
- Revert Tab: Revert payment periods
- Repair Tab: Fix data issues
- Sync Tab: Fix member status issues
```

## Database Function Calls (Direct SQL)
```sql
-- Get opening balance
SELECT * FROM get_opening_balance('user-id', '2024-06');

-- Calculate closing balance
SELECT * FROM calculate_closing_balance('user-id', '2024-06');

-- Revert period
SELECT * FROM revert_period_payment('user-id', '2024-06', 'admin-id');

-- Validate balance
SELECT * FROM validate_balance_consistency('user-id');

-- Sync member status
SELECT * FROM sync_member_status_on_loan_conversion('user-id');
```

## Imports Summary
```typescript
// Calculator utilities
import { 
  reconstructClosingBalance,
  calculateInterestWithAccumulation,
  calculateSubscriptionWithAccumulation,
  getPriorityBasedOpeningBalance,
  calculateTotalPayment
} from '@/lib/utils/loan-calculator'

// Balance recovery
import { balanceRecoveryService } from '@/lib/utils/balance-recovery'

// Member status
import { memberStatusService } from '@/lib/utils/member-status'

// Data integrity
import { dataIntegrityService } from '@/lib/utils/data-integrity'

// Month initialization
import { initializeMonthAction } from '@/lib/server-actions/initialize-month'
```

## Documentation Links
- **Full Guide:** `/docs/BALANCE-ARCHITECTURE.md`
- **Implementation:** `/docs/IMPLEMENTATION-SUMMARY.md`
- **This Guide:** `/docs/QUICK-REFERENCE.md`

## Support
For questions or issues with the balance architecture:
1. Check `/docs/BALANCE-ARCHITECTURE.md` for detailed explanations
2. Review examples in `/docs/QUICK-REFERENCE.md`
3. Use admin panel validation tools to diagnose issues
4. Check reconciliation reports for detailed balance history
