# Loan Balance Architecture Implementation Guide

## Overview

This document describes the implementation of the complete loan balance architecture that establishes `loan_payments.remaining_balance` as the single source of truth for balance calculations across all periods.

## Architecture Principles

### 1. Single Source of Truth
- **Primary Source:** `loan_payments.remaining_balance` (recorded closing balance for each period)
- **Backup Source:** `loans.original_loan_amount` (static reference amount)
- **Fallback Source:** Reconstruction formula when historical data is incomplete

### 2. Balance Formula
```
Closing Balance = Opening Balance - EMI - Additional Principal + New Loan Amount

Where:
- Opening Balance = Previous period's remaining_balance (or original_loan_amount if first period)
- EMI = Monthly Equated Installment payments (reduces balance)
- Additional Principal = Extra principal payments (reduces balance)
- New Loan Amount = Sum of additional_loan_amount for the period (increases balance)
```

### 3. Revert Formula
```
Opening Balance = Closing Balance + EMI + Additional Principal - New Loan Amount

This is the inverse of the closing formula for reconstructing prior period balances.
```

### 3. Member Status Synchronization
- **Initial State:** `subscription_only` (members who pay only subscription, no active loan)
- **Conversion Trigger:** When a new loan is added to a subscription_only member
- **Final State:** `active` (member with active loan)
- **Automatic:** Triggered via trigger function on loan status update

## Implementation Components

### Database Layer

#### File: `/scripts/74-implement-balance-architecture.sql`

**Functions Created:**

1. **`get_opening_balance(user_id, period_key)`**
   - Priority 1: Previous period's closing balance
   - Priority 2: Original loan amount
   - Priority 3: Reconstruction formula
   - Returns numeric opening balance

2. **`calculate_closing_balance(user_id, period_key)`**
   - Applies formula: Closing = Opening - EMI - Additional Principal + New Loans
   - Returns numeric closing balance

3. **`revert_period_payment(user_id, period_key, reverted_by)`**
   - Deletes all payments for a period
   - Restores balance using priority logic
   - Returns JSON with success status

4. **`sync_member_status_on_loan_conversion(user_id)`**
   - Upgrades subscription_only to active when both statuses exist
   - Returns JSON with action taken

5. **`validate_balance_consistency(user_id)`**
   - Returns table of all periods with balance validation
   - Shows recorded vs calculated closing balances
   - Identifies discrepancies

#### Indexes Created
- `idx_loan_payments_user_period` - Fast lookup of user's latest payments
- `idx_loan_payments_status` - Status-based queries
- `idx_loans_user_status` - Loan lookup by user and status
- `idx_monthly_loan_records_user_period` - Monthly record queries

#### Trigger Created
- `trg_sync_member_status` - Automatically calls sync function when loan status changes

### Application Layer

#### File: `/lib/utils/loan-calculator.ts`

**New Interfaces:**
- `BalanceReconstruction` - Detailed balance calculation breakdown
- `BalanceValidation` - Validation report for a period

**New Functions:**
- `reconstructClosingBalance()` - Apply formula to get closing balance
- `validateBalanceConsistency()` - Check recorded vs calculated
- `calculateInterestWithAccumulation()` - Interest with carried forward amounts
- `calculateSubscriptionWithAccumulation()` - Subscription with carried forward amounts
- `getPriorityBasedOpeningBalance()` - Priority-based opening balance selection
- `calculateTotalPayment()` - Sum all payment components

#### File: `/lib/utils/balance-recovery.ts` (NEW)

**Class: `BalanceRecoveryService`**
- `revertPeriod()` - Revert a payment period
- `getOpeningBalance()` - Get period's opening balance
- `calculateClosingBalance()` - Calculate period's closing balance
- `reconstructBalance()` - Full reconstruction with all components
- `validateBalanceConsistency()` - Validate a period's balance
- `syncMemberStatus()` - Trigger member status sync
- `getBalanceHistory()` - Get complete balance history

#### File: `/lib/utils/member-status.ts` (NEW)

**Class: `MemberStatusService`**
- `isSubscriptionOnly()` - Check if member is subscription-only
- `convertSubscriptionToActive()` - Convert subscription to active with loan
- `getMemberStatus()` - Get current member status
- `getMemberLoans()` - Get all loans for member
- `ensureStatusConsistency()` - Maintenance function for status

#### File: `/lib/utils/data-integrity.ts` (NEW)

**Class: `DataIntegrityService`**
- `validateAllBalances()` - Validate all or specific user balances
- `checkOriginalAmountPopulation()` - Check if original_loan_amount is set
- `fixMissingOriginalAmounts()` - Populate missing original amounts
- `checkOrphanedPayments()` - Find payments with no loan
- `verifyBalanceChain()` - Verify balance chain consistency
- `generateReconciliationReport()` - Generate detailed report
- `findDuplicatePayments()` - Identify duplicate records
- `verifyMemberStatusConsistency()` - Check member status consistency

## Usage Examples

### Example 1: Recording a Payment

```typescript
import { memberStatusService } from '@/lib/utils/member-status'
import { balanceRecoveryService } from '@/lib/utils/balance-recovery'

// When recording a payment for a subscription_only member
const isSubscriptionOnly = await memberStatusService.isSubscriptionOnly(userId)

if (isSubscriptionOnly && newLoanAmount > 0) {
  // Get opening balance first
  const opening = await balanceRecoveryService.getOpeningBalance(userId, periodKey)
  
  // Convert and record
  await memberStatusService.convertSubscriptionToActive(
    userId,
    loanId,
    newLoanAmount,
    opening,
    interestRate
  )
}

// Calculate and record closing balance
const closing = Math.max(
  0,
  opening + newLoanAmount - emi - additionalPrincipal
)

// Record in loan_payments with closing balance
await supabase.from('loan_payments').insert({
  // ... other fields
  remaining_balance: closing
})
```

### Example 2: Reverting a Period

```typescript
import { balanceRecoveryService } from '@/lib/utils/balance-recovery'

// Revert a specific period
const result = await balanceRecoveryService.revertPeriod(
  userId,
  '2024-06',
  adminUserId
)

if (result.success) {
  console.log(`Reverted ${result.deleted_count} records`)
  console.log(`Restored balance: ${result.restored_balance}`)
}
```

### Example 3: Validating Balances

```typescript
import { dataIntegrityService } from '@/lib/utils/data-integrity'

// Check all user's balances
const issues = await dataIntegrityService.validateAllBalances(userId)

// Find inconsistencies
const inconsistent = issues.filter(i => !i.is_valid)

console.log(`Found ${inconsistent.length} periods with balance mismatches`)
```

### Example 4: Member Status Consistency

```typescript
import { dataIntegrityService } from '@/lib/utils/data-integrity'

// Check system-wide consistency
const result = await dataIntegrityService.verifyMemberStatusConsistency()

console.log(`Checked ${result.totalUsersChecked} users`)
console.log(`Found ${result.inconsistencies.length} inconsistencies`)

// Fix them
if (!result.isConsistent) {
  for (const issue of result.inconsistencies) {
    await memberStatusService.ensureStatusConsistency(issue.userId)
  }
}
```

## Data Migration Steps

1. **Run Migration Script**
   ```sql
   -- Execute /scripts/74-implement-balance-architecture.sql
   -- This creates all functions, indexes, and triggers
   ```

2. **Populate Missing Original Amounts**
   ```typescript
   const integrity = new DataIntegrityService()
   await integrity.fixMissingOriginalAmounts()
   ```

3. **Validate All Balances**
   ```typescript
   const integrity = new DataIntegrityService()
   const issues = await integrity.validateAllBalances()
   ```

4. **Fix Any Inconsistencies**
   ```typescript
   // Review issues and decide on corrections
   // Use revert logic for problematic periods
   ```

5. **Verify Member Status Consistency**
   ```typescript
   const result = await integrity.verifyMemberStatusConsistency()
   // Should show isConsistent: true
   ```

## Key Design Decisions

### 1. Remaining Balance as Single Source of Truth
**Why:** Historical balance records are immutable after recording. This prevents cascading errors when loan amounts are later modified.

### 2. Priority-Based Opening Balance
**Why:** Provides fallback options if historical data is incomplete, without breaking calculations.

### 3. Automatic Member Status Sync
**Why:** Ensures data consistency automatically, preventing manual coordination errors between loan status and member payments.

### 4. Trigger-Based Conversion
**Why:** Centralized logic means conversion happens consistently regardless of which component initiates it.

### 5. Separate Utilities for Different Concerns
**Why:** Clear separation makes testing, maintenance, and understanding easier. Each service has a specific responsibility.

## Maintenance Tasks

### Regular Checks
```typescript
// Weekly consistency check
const integrity = new DataIntegrityService()
const result = await integrity.verifyMemberStatusConsistency()
if (!result.isConsistent) {
  // Alert admins
}
```

### Periodic Reconciliation
```typescript
// Monthly reconciliation report
for (const userId of activeUsers) {
  const report = await integrity.generateReconciliationReport(userId)
  // Archive for audit trail
}
```

### Annual Cleanup
```typescript
// Check for duplicates and orphaned records
const duplicates = await integrity.findDuplicatePayments()
const orphaned = await integrity.checkOrphanedPayments()
// Review and clean up
```

## Error Handling

All services throw errors with descriptive messages. Recommended pattern:

```typescript
try {
  const balance = await balanceRecoveryService.getOpeningBalance(userId, periodKey)
} catch (err) {
  console.error('Failed to get balance:', err.message)
  // Fallback logic or user notification
}
```

## Performance Considerations

- Indexes on `(user_id, period_year DESC, period_month DESC)` make balance lookups O(log n)
- Batch operations recommended for bulk migrations
- Validation functions designed to be admin-only (not called frequently)
- Client-side caching of user's current balance recommended

## Future Enhancements

1. **Audit Trail:** Log all balance-affecting operations
2. **Snapshots:** Periodically store validated balances for audit
3. **Reconciliation Service:** Automatic periodic validation
4. **Dashboard:** Visual balance history and anomaly detection
5. **Alerts:** Real-time alerts for balance inconsistencies
