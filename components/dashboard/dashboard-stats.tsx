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
    const { data: loans } = await supabase.from("loans").select("loan_amount, status, created_at")

    const { data: payments } = await supabase
      .from("loan_payments")
      .select("interest_paid, principal_paid, monthly_emi, monthly_subscription, status, period_key, created_at")

    const { data: requests } = await supabase.from("loan_requests").select("status")

    const currentDate = new Date()
    const currentPeriodKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`

    const totalLoansIssued =
      loans?.reduce((sum, loan) => {
        if ((loan.status === "active" || loan.status === "completed") && loan.created_at) {
          const loanDate = new Date(loan.created_at)
          const loanPeriodKey = `${loanDate.getFullYear()}-${String(loanDate.getMonth() + 1).padStart(2, "0")}`
          if (loanPeriodKey === currentPeriodKey) {
            return sum + Number(loan.loan_amount)
          }
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
          return sum + Number(payment.principal_paid || 0)
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
    const investedAmount = 0
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

  // User stats
  const { data: loans } = await supabase
    .from("loans")
    .select("loan_amount, remaining_balance, status, created_at")
    .eq("user_id", userId)

  const { data: payments } = await supabase
    .from("loan_payments")
    .select("interest_paid, remaining_balance, monthly_subscription, status, period_key")
    .eq("user_id", userId)

  const currentDate = new Date()
  const currentPeriodKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`

  const totalLoanTaken = loans?.reduce((sum, loan) => sum + Number(loan.loan_amount), 0) || 0

  const totalInterestPaid =
    payments?.reduce((sum, payment) => {
      if (payment.status === "paid" && payment.period_key === currentPeriodKey) {
        return sum + Number(payment.interest_paid || 0)
      }
      return sum
    }, 0) || 0

  const activeLoans = loans?.filter((loan) => loan.status === "active") || []

  const pendingBalance =
    loans?.filter((loan) => loan.status === "active").reduce((sum, loan) => sum + Number(loan.remaining_balance), 0) ||
    0

  const missedPayments = payments?.filter((payment) => payment.status === "missed").length || 0

  const totalSubscriptionPaid =
    payments?.reduce((sum, payment) => {
      if (payment.status === "paid" && payment.period_key === currentPeriodKey) {
        return sum + Number(payment.monthly_subscription || 0)
      }
      return sum
    }, 0) || 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Loan Taken</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{formatCurrency(totalLoanTaken)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Interest Paid</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{formatCurrency(totalInterestPaid)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Pending Balance</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{formatCurrency(pendingBalance)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Active Loans</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{activeLoans.length}</div>
          {missedPayments > 0 && <p className="text-xs text-red-600 mt-1">{missedPayments} missed payment(s)</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Subscription Paid</CardTitle>
          <PiggyBank className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{formatCurrency(totalSubscriptionPaid)}</div>
        </CardContent>
      </Card>
    </div>
  )
}
