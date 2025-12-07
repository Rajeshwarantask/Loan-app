import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, TrendingUp, AlertCircle, CheckCircle } from "lucide-react"
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
    const { data: loans } = await supabase.from("loans").select("amount, status")

    const { data: payments } = await supabase.from("loan_payments").select("interest_paid, status")

    const { data: requests } = await supabase.from("loan_requests").select("status")

    const totalLoansIssued =
      loans?.reduce(
        (sum, loan) => (loan.status === "active" || loan.status === "completed" ? sum + Number(loan.amount) : sum),
        0,
      ) || 0

    const totalInterestCollected =
      payments?.reduce((sum, payment) => (payment.status === "paid" ? sum + Number(payment.interest_paid) : sum), 0) ||
      0

    const activeLoans = loans?.filter((loan) => loan.status === "active").length || 0
    const pendingRequests = requests?.filter((req) => req.status === "pending").length || 0

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Loans</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{activeLoans}</div>
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
    )
  }

  // User stats
  const { data: loans } = await supabase.from("loans").select("amount, status").eq("user_id", userId)

  const { data: payments } = await supabase
    .from("loan_payments")
    .select("interest_paid, remaining_balance, status")
    .eq("user_id", userId)

  const totalLoanTaken = loans?.reduce((sum, loan) => sum + Number(loan.amount), 0) || 0

  const totalInterestPaid =
    payments?.reduce((sum, payment) => (payment.status === "paid" ? sum + Number(payment.interest_paid) : sum), 0) || 0

  const activeLoans = loans?.filter((loan) => loan.status === "active") || []

  const pendingBalance =
    payments?.reduce(
      (sum, payment) =>
        payment.status === "unpaid" || payment.status === "partial" ? sum + Number(payment.remaining_balance) : sum,
      0,
    ) || 0

  const missedPayments = payments?.filter((payment) => payment.status === "missed").length || 0

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
    </div>
  )
}
