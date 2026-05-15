import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Wallet,
  PiggyBank,
  BarChart3,
  Target,
  Clock,
  CreditCard,
  TrendingDown,
  Award,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils/loan-calculator"
import type { UserRole } from "@/lib/types"

interface DashboardStatsProps {
  userId: string
  role: UserRole
}

export async function DashboardStats({ userId, role }: DashboardStatsProps) {
  const supabase = await createClient()

  // Calculate current period key at the start for both admin and user
  const currentDate = new Date()
  const currentPeriodKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`

  if (role === "admin") {
    // Admin stats - all from loan_payments for this month
    const { data: loans } = await supabase.from("loans").select("loan_amount, status, created_at")

    const { data: payments } = await supabase
      .from("loan_payments")
      .select(
        "user_id, interest_paid, principal_paid, additional_principal, monthly_emi, monthly_subscription, status, period_key, remaining_balance, created_at",
      )

    const { data: requests } = await supabase.from("loan_requests").select("status")

    const { data: investments } = await supabase.from("investments").select("amount")

    const activeLoans = loans?.filter((loan) => loan.status === "active").length || 0
    const pendingRequests = requests?.filter((req) => req.status === "pending").length || 0

    // All figures are for this month's paid records only
    const thisMonthPaid = payments?.filter(
      (p) => p.status === "paid" && p.period_key === currentPeriodKey
    ) || []

    // Total Loans Issued = sum of loan_amount from loans table for all active loans
    // loans.loan_amount = current outstanding balance, kept in sync after every payment
    const totalLoansIssued =
      loans?.reduce((sum, loan) => {
        if (loan.status === "active") {
          return sum + Number(loan.loan_amount || 0)
        }
        return sum
      }, 0) || 0

    const totalInterestCollected = thisMonthPaid.reduce((sum, p) => sum + Number(p.interest_paid || 0), 0)
    const currentMonthEmi = thisMonthPaid.reduce((sum, p) => sum + Number(p.monthly_emi || 0), 0)
    const totalPrincipalCollected = thisMonthPaid.reduce(
      (sum, p) => sum + Number(p.principal_paid || 0) + Number(p.additional_principal || 0),
      0
    )
    const currentMonthSubscription = thisMonthPaid.reduce((sum, p) => sum + Number(p.monthly_subscription || 0), 0)
    const totalSubscriptionReceived = currentMonthSubscription

    const totalTurnover = totalSubscriptionReceived + totalLoansIssued + currentMonthEmi + totalInterestCollected + totalPrincipalCollected

    const investedAmount = investments?.reduce((sum, investment) => sum + Number(investment.amount || 0), 0) || 0

    const remainingTurnover = totalTurnover - investedAmount

    const monthlyInHandClosing = currentMonthEmi + totalSubscriptionReceived + totalInterestCollected + totalPrincipalCollected

    const cagrRate = 6.2 // For now

    return (
      <>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Turnover</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatCurrency(totalTurnover)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Invested Amount</CardTitle>
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatCurrency(investedAmount)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Remaining Turnover</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatCurrency(remainingTurnover)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monthly InHand Closing</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatCurrency(monthlyInHandClosing)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">CAGR Rate %</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{cagrRate}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Loans</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{activeLoans}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Loans Issued</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatCurrency(totalLoansIssued)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Interest Collected</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatCurrency(totalInterestCollected)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Principal Collected</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatCurrency(totalPrincipalCollected)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Monthly EMI</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatCurrency(currentMonthEmi)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Subscription</CardTitle>
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatCurrency(totalSubscriptionReceived)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{pendingRequests}</div>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  // User stats - all from loan_payments + loans only, no monthly_loan_records
  const { data: loans } = await supabase
    .from("loans")
    .select("loan_amount, status, interest_rate, created_at")
    .eq("user_id", userId)

  const { data: payments } = await supabase
    .from("loan_payments")
    .select(
      "interest_paid, principal_paid, additional_principal, monthly_emi, monthly_subscription, penalty, remaining_balance, status, period_key",
    )
    .eq("user_id", userId)

  const { data: allActiveLoans } = await supabase
  .from("loans")
  .select("loan_amount")
  .eq("status", "active")

  // 1. Total Loan: use latest paid payment's remaining_balance, fallback to loans.loan_amount (current outstanding)
  const sortedPayments = [...(payments || [])].sort((a, b) =>
    b.period_key > a.period_key ? 1 : b.period_key < a.period_key ? -1 : 0
  )
  const latestPayment = sortedPayments[0]
  const activeLoan = loans?.find((l) => l.status === "active")
  const totalLoan = latestPayment
    ? Number(latestPayment.remaining_balance || 0)
    : Number(activeLoan?.loan_amount || 0)

  const totalLoansIssuedAll =
    allActiveLoans?.reduce((sum, loan) => {
      return sum + Number(loan.loan_amount || 0)
    }, 0) || 0

  // 2. Interest this month
  const interestThisMonth =
    payments?.reduce((sum, p) => {
      if (p.period_key === currentPeriodKey) return sum + Number(p.interest_paid || 0)
      return sum
    }, 0) || 0

  // 3. EMI total paid all time
  const totalEMI = payments?.reduce((sum, p) => sum + Number(p.monthly_emi || 0), 0) || 0

  // 4. Subscription total paid all time
  const totalSubscription = payments?.reduce((sum, p) => sum + Number(p.monthly_subscription || 0), 0) || 0

  // 5. Principal total paid all time
  const totalPrincipal =
    payments?.reduce((sum, p) => sum + Number(p.principal_paid || 0) + Number(p.additional_principal || 0), 0) || 0

  // 6. Available Loan
  const availableLoan = 400000 - totalLoan

  // 7. Penalty total paid all time
  const totalPenalty = payments?.reduce((sum, p) => sum + Number(p.penalty || 0), 0) || 0

  // 8. Total Earnings/Person
  // Opening balance = last month's remaining_balance (from loan_payments), or loan amount if new
  const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
  const prevPeriodKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`
  const lastMonthPayment = sortedPayments.find((p) => p.period_key === prevPeriodKey)
  const openingBalance = lastMonthPayment
    ? Number(lastMonthPayment.remaining_balance || 0)
    : Number(loans?.find((l) => l.status === "active")?.loan_amount || 0)

  // monthlyInHandClosing = openingBalance + interest this month
  const monthlyInHandClosing = openingBalance + interestThisMonth
  const CONSTANT_MEMBER_COUNT = 44
  const totalEarnings = Math.round(totalLoansIssuedAll / CONSTANT_MEMBER_COUNT)
  // Total Payment = Interest + EMI + Subscription (all-time)
  const totalPayment =
    (payments?.reduce((sum, p) => {
      return (
        sum +
        Number(p.interest_paid || 0) +
        Number(p.monthly_emi || 0) +
        Number(p.monthly_subscription || 0)
      )
    }, 0) || 0)

  return (
    <>
      {/* Top row - 4 stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {/* Order: 4, 2, 3, 5 = Total Payment ,Subscription, Interest, EMI */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Payment
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrency(totalPayment)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Interest + EMI + Subscription
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Subscription</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(totalSubscription)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total paid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Interest</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(interestThisMonth)}</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">EMI</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(totalEMI)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total paid</p>
          </CardContent>
        </Card>

      </div>

      {/* Bottom row - 4 stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Principal</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(totalPrincipal)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total paid</p>
          </CardContent>
        </Card>

        {/* Total Loan (Available shown inside) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Loan
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrency(totalLoan)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Available: {formatCurrency(availableLoan)}
            </p>
          </CardContent>
        </Card>

        {/* Total Earnings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Earnings
            </CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrency(totalEarnings)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per person
            </p>
          </CardContent>
        </Card>

        {/* Penalty */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Penalty
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrency(totalPenalty)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total paid
            </p>
          </CardContent>
        </Card>

      </div>
    </>
  )
}
