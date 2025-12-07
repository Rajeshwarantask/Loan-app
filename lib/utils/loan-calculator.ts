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
  durationMonths: number
  totalInterest: number
  totalAmount: number
  monthlyPayment: number
  breakdown: LoanCalculation[]
}

export function calculateLoan(amount: number, interestRate: number, durationMonths: number): LoanSummary {
  const principal = amount
  const monthlyInterestRate = interestRate / 100

  // Simple interest calculation for community loan
  const totalInterest = principal * monthlyInterestRate * durationMonths
  const totalAmount = principal + totalInterest
  const monthlyPayment = totalAmount / durationMonths

  const breakdown: LoanCalculation[] = []
  let remainingBalance = totalAmount

  for (let month = 1; month <= durationMonths; month++) {
    const interestForMonth = (remainingBalance / durationMonths) * (interestRate / 100)
    const principalForMonth = monthlyPayment - interestForMonth

    remainingBalance -= monthlyPayment

    breakdown.push({
      month,
      monthLabel: `Month ${month}`,
      principalPaid: principalForMonth,
      interestPaid: interestForMonth,
      totalPayment: monthlyPayment,
      remainingBalance: Math.max(0, remainingBalance),
    })
  }

  return {
    loanAmount: amount,
    interestRate,
    durationMonths,
    totalInterest,
    totalAmount,
    monthlyPayment,
    breakdown,
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
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
