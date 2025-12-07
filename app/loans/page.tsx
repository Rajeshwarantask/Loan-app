import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, getMonthYearLabel } from "@/lib/utils/loan-calculator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"

export default async function LoansPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()

  if (!profile) {
    redirect("/auth/login")
  }

  const { data: loans } = await supabase
    .from("loans")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const { data: payments } = await supabase
    .from("loan_payments")
    .select("*")
    .eq("user_id", user.id)
    .order("month_year", { ascending: false })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="container max-w-6xl py-6 space-y-6">
          <div className="pl-12 md:pl-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">My Loans</h1>
            <p className="text-muted-foreground">View your loan history and payment details</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Active Loans</CardTitle>
            </CardHeader>
            <CardContent>
              {loans && loans.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Interest Rate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Closed On</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loans.map((loan) => (
                        <TableRow key={loan.id}>
                          <TableCell className="font-semibold">{formatCurrency(Number(loan.amount))}</TableCell>
                          <TableCell>{loan.interest_rate}%</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                loan.status === "active"
                                  ? "default"
                                  : loan.status === "completed"
                                    ? "secondary"
                                    : loan.status === "approved"
                                      ? "default"
                                      : "destructive"
                              }
                            >
                              {loan.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(loan.requested_at), "MMM dd, yyyy")}</TableCell>
                          <TableCell>
                            {loan.status === "completed" && loan.updated_at ? (
                              format(new Date(loan.updated_at), "MMM dd, yyyy")
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No loans found
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {payments && payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Interest</TableHead>
                        <TableHead className="text-center">Interest Status</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">{getMonthYearLabel(payment.month_year)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(payment.principal_paid))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(payment.interest_paid))}</TableCell>
                          <TableCell className="text-center">
                            {Number(payment.interest_paid) > 0 ? (
                              <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                                Paid
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-slate-400 hover:bg-slate-500 text-white">
                                Unpaid
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(payment.remaining_balance))}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                payment.status === "paid"
                                  ? "default"
                                  : payment.status === "partial"
                                    ? "secondary"
                                    : payment.status === "missed"
                                      ? "destructive"
                                      : "outline"
                              }
                            >
                              {payment.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No payment history found
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
