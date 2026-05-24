export interface LoanCalculation {
  month: number
  monthLabel: string
  principalPaid: number
  interestPaid: number
  totalPayment: number
  remainingBalance: number
}

export interface LoanSummary {
  loanAmount: number
  interestRate: number
  totalInterest: number
  monthlyPayment: number
}

export interface BalanceReconstruction {
  openingBalance: number
  emiPaid: number
  additionalPrincipal: number
  newLoansAdded: number
  closingBalance: number
  calculationMethod: 'prior_closing' | 'original_amount' | 'reconstruction'
}

export interface BalanceValidation {
  isValid: boolean
  periodKey: string
  openingBalance: number
  recordedClosing: number
  calculatedClosing: number
  variance: number
  issue?: string
}

export function calculateLoan(amount: number, interestRate: number): LoanSummary {
  const principal = amount
  const monthlyInterestRate = interestRate / 100
  const monthlyInterest = principal * monthlyInterestRate
  const monthlyPayment = principal + monthlyInterest

  return {
    loanAmount: amount,
    interestRate,
    totalInterest: monthlyInterest,
    monthlyPayment,
  }
}

export function formatCurrency(amount: number): string {
  if (amount === 0) return "₹0"

  // Use Indian locale for proper formatting
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount)

  return formatted
}

export function getCurrentMonthYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

export function getMonthYearLabel(monthYear: string): string {
  const [year, month] = monthYear.split("-")
  const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1)
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" })
}

/**
 * Calculate closing balance using the formula:
 * Closing Balance = Opening Balance - EMI - Additional Principal + New Loan Amount
 */
export function reconstructClosingBalance(
  openingBalance: number,
  emiPaid: number,
  additionalPrincipal: number,
  newLoans: number
): number {
  return Math.max(0, openingBalance - emiPaid - additionalPrincipal + newLoans)
}

/**
 * Validate balance consistency for a period
 * Checks if recorded closing balance matches calculated closing balance
 */
export function validateBalanceConsistency(
  recordedClosing: number,
  calculatedClosing: number,
  toleranceAmount: number = 1
): BalanceValidation {
  const variance = Math.abs(recordedClosing - calculatedClosing)
  const isValid = variance < toleranceAmount

  return {
    isValid,
    periodKey: "",
    openingBalance: 0,
    recordedClosing,
    calculatedClosing,
    variance,
    issue: isValid ? undefined : "Balance mismatch detected"
  }
}

/**
 * Calculate interest payment with carrying forward unpaid amounts
 */
export function calculateInterestWithAccumulation(
  openingBalance: number,
  interestRate: number,
  previousUnpaidInterest: number = 0
): number {
  const currentMonthInterest = Math.round((openingBalance * interestRate) / 100)
  return previousUnpaidInterest + currentMonthInterest
}

/**
 * Calculate subscription fee with carrying forward unpaid amounts
 */
export function calculateSubscriptionWithAccumulation(
  monthlySubscription: number = 2100,
  previousUnpaidSubscription: number = 0
): number {
  return previousUnpaidSubscription + monthlySubscription
}

/**
 * Determine opening balance using priority order:
 * 1. Previous period's closing balance
 * 2. Original loan amount
 * 3. Reconstruction formula
 */
export function getPriorityBasedOpeningBalance(
  previousClosing?: number,
  originalLoanAmount?: number,
  reconstructionFallback?: number
): number {
  if (previousClosing !== undefined && previousClosing !== null && previousClosing >= 0) {
    return previousClosing
  }

  if (originalLoanAmount !== undefined && originalLoanAmount !== null && originalLoanAmount >= 0) {
    return originalLoanAmount
  }

  if (reconstructionFallback !== undefined && reconstructionFallback !== null) {
    return reconstructionFallback
  }

  return 0
}

/**
 * Calculate total loan payment for a period
 * Total = Interest + EMI + Additional Principal + Subscription + Penalty
 */
export function calculateTotalPayment(
  interest: number,
  emi: number,
  additionalPrincipal: number,
  subscription: number,
  penalty: number = 0
): number {
  return interest + emi + additionalPrincipal + subscription + penalty
}
