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
