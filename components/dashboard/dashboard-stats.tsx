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

  if (role === "admin") {
    // Admin stats
    const { data: loans } = await supabase.from("loans").select("loan_amount, remaining_balance, status, created_at")

    const { data: payments } = await supabase
      .from("loan_payments")
      .select(
        "interest_paid, principal_paid, additional_principal, monthly_emi, monthly_subscription, status, period_key, created_at",
      )

    const { data: requests } = await supabase.from("loan_requests").select("status")

    const { data: investments } = await supabase.from("investments").select("amount")

    const currentDate = new Date()
    const currentPeriodKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`

    const totalLoansIssued =
      loans?.reduce((sum, loan) => {
        if (loan.status === "active") {
          return sum + Number(loan.remaining_balance || 0)
        }
        return sum
      }, 0) || 0

    const totalInterestCollected =
      payments?.reduce((sum, payment) => {
        if (payment.status === "paid" && payment.period_key === currentPeriodKey) {
          return sum + Number(payment.interest_paid || 0)
        }
        return sum
      }, 0) || 0

    const activeLoans = loans?.filter((loan) => loan.status === "active").length || 0
    const pendingRequests = requests?.filter((req) => req.status === "pending").length || 0

    const currentMonthEmi =
      payments?.reduce((sum, payment) => {
        if (payment.status === "paid" && payment.period_key === currentPeriodKey) {
          return sum + Number(payment.monthly_emi || 0)
        }
        return sum
      }, 0) || 0

    const totalPrincipalCollected =
      payments?.reduce((sum, payment) => {
        if (payment.status === "paid" && payment.period_key === currentPeriodKey) {
          return sum + Number(payment.principal_paid || 0) + Number(payment.additional_principal || 0)
        }
        return sum
      }, 0) || 0

    const currentMonthSubscription =
      payments?.reduce((sum, payment) => {
        if (payment.status === "paid" && payment.period_key === currentPeriodKey) {
          return sum + Number(payment.monthly_subscription || 0)
        }
        return sum
      }, 0) || 0

    const totalSubscriptionReceived = currentMonthSubscription

    const totalTurnover = totalSubscriptionReceived + totalLoansIssued + currentMonthEmi + totalInterestCollected

    const investedAmount = investments?.reduce((sum, investment) => sum + Number(investment.amount || 0), 0) || 0

    const remainingTurnover = totalTurnover - investedAmount

    const monthlyInHandClosing = totalLoansIssued + totalInterestCollected
    const cagrRate = 0 // For now

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

  // User stats - fetch comprehensive payment data
  const { data: loans } = await supabase
    .from("loans")
    .select("loan_amount, remaining_balance, status, interest_rate")
    .eq("user_id", userId)

  const { data: payments } = await supabase
    .from("loan_payments")
    .select(
      "interest_paid, principal_paid, additional_principal, monthly_emi, monthly_subscription, penalty, remaining_balance, status, period_key",
    )
    .eq("user_id", userId)

  const currentDate = new Date()
  const currentPeriodKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`

  // 1. Total Loan (current month closing balance from latest payment)
  const latestPayment = payments?.sort((a, b) => {
    if (b.period_key > a.period_key) return 1
    if (b.period_key < a.period_key) return -1
    return 0
  })[0]
  const totalLoan = latestPayment ? Number(latestPayment.remaining_balance || 0) : 0

  // 2. Interest (this month's interest payment)
  const interestThisMonth =
    payments?.reduce((sum, payment) => {
      if (payment.period_key === currentPeriodKey) {
        return sum + Number(payment.interest_paid || 0)
      }
      return sum
    }, 0) || 0

  // 3. EMI (total EMI paid - all time)
  const totalEMI = payments?.reduce((sum, payment) => sum + Number(payment.monthly_emi || 0), 0) || 0

  // 4. Subscription (total subscription paid - all time)
  const totalSubscription = payments?.reduce((sum, payment) => sum + Number(payment.monthly_subscription || 0), 0) || 0

  // 5. Principal (total principal paid - all time)
  const totalPrincipal =
    payments?.reduce((sum, payment) => {
      return sum + Number(payment.principal_paid || 0) + Number(payment.additional_principal || 0)
    }, 0) || 0

  // 6. Available Loan (subscription * 10 - current loan balance)
  const availableLoan = Math.max(0, totalSubscription * 10 - totalLoan)

  // 7. Penalty (total penalty paid from loan_payments - all time)
  const totalPenalty = payments?.reduce((sum, payment) => sum + Number(payment.penalty || 0), 0) || 0

  // 8. Total Earnings/Person (set to 0 for now)
  const totalEarnings = 0

  return (
    <>
      {/* Top row - 4 stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {/* Order: 4, 2, 3, 5 = Subscription, Interest, EMI, Principal */}
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
      </div>

      {/* Bottom row - 4 stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {/* Order: 1, 8, 6, 7 = Total Loan, Total Earnings, Available Loan, Penalty */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Loan</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(totalLoan)}</div>
            <p className="text-xs text-muted-foreground mt-1">Current balance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Earnings</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(totalEarnings)}</div>
            <p className="text-xs text-muted-foreground mt-1">Per person</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available Loan</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(availableLoan)}</div>
            <p className="text-xs text-muted-foreground mt-1">Can borrow</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Penalty</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(totalPenalty)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total paid</p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
