"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils/loan-calculator"
import { format } from "date-fns"
import { ChevronDown, ChevronRight } from "lucide-react"

interface LoanPayment {
  id: string
  loan_id: string
  user_id: string
  month_year: string
  principal_paid: number
  interest_paid: number
  remaining_balance: number
  status: string
  payment_date: string | null
}

interface Loan {
  id: string
  user_id: string
  amount: number
  interest_rate: number
  duration_months: number
  status: string
  requested_at: string
  approved_at: string | null
  profiles: {
    full_name: string
    member_id: string | null
  }
}

interface LoanHistoryTableProps {
  payments: LoanPayment[]
  loans: Loan[]
}

export function LoanHistoryTable({ payments, loans }: LoanHistoryTableProps) {
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null)

  const loanGroups = useMemo(() => {
    const groups = new Map<string, { loan: Loan; payments: LoanPayment[] }>()

    // Get all loans that have payments
    const loanIds = new Set(payments.map((p) => p.loan_id))

    loanIds.forEach((loanId) => {
      const loan = loans.find((l) => l.id === loanId)
      const loanPayments = payments
        .filter((p) => p.loan_id === loanId)
        .sort(
          (a, b) =>
            new Date(a.payment_date || a.month_year).getTime() - new Date(b.payment_date || b.month_year).getTime(),
        )

      if (loan) {
        groups.set(loanId, { loan, payments: loanPayments })
      }
    })

    return Array.from(groups.values())
  }, [payments, loans])

  if (loanGroups.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No payment history found</div>
  }

  return (
    <div className="space-y-4">
      {loanGroups.map(({ loan, payments: loanPayments }) => {
        const isExpanded = expandedLoan === loan.id
        const totalPrincipal = loanPayments.reduce((sum, p) => sum + p.principal_paid, 0)
        const totalInterest = loanPayments.reduce((sum, p) => sum + p.interest_paid, 0)

        return (
          <Card key={loan.id} className="overflow-hidden">
            <CardHeader
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setExpandedLoan(isExpanded ? null : loan.id)}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <CardTitle className="text-base">
                      {loan.profiles.member_id ? `${loan.profiles.member_id} - ` : ""}
                      {loan.profiles.full_name}
                    </CardTitle>
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-4">
                    <span>Loan Amount: {formatCurrency(loan.amount)}</span>
                    <span>Rate: {loan.interest_rate}%</span>
                    <span>Duration: {loan.duration_months} months</span>
                    <Badge variant={loan.status === "active" ? "default" : "secondary"}>{loan.status}</Badge>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">{loanPayments.length} payments</div>
                  <div className="text-muted-foreground">Total: {formatCurrency(totalPrincipal + totalInterest)}</div>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month/Year</TableHead>
                        <TableHead>Principal Paid</TableHead>
                        <TableHead>Interest Paid</TableHead>
                        <TableHead>Total Paid</TableHead>
                        <TableHead>Remaining Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loanPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">{payment.month_year}</TableCell>
                          <TableCell>{formatCurrency(payment.principal_paid)}</TableCell>
                          <TableCell>{formatCurrency(payment.interest_paid)}</TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(payment.principal_paid + payment.interest_paid)}
                          </TableCell>
                          <TableCell>{formatCurrency(payment.remaining_balance)}</TableCell>
                          <TableCell>
                            <Badge variant={payment.status === "paid" ? "default" : "secondary"}>
                              {payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {payment.payment_date ? format(new Date(payment.payment_date), "MMM dd, yyyy") : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell>Total</TableCell>
                        <TableCell>{formatCurrency(totalPrincipal)}</TableCell>
                        <TableCell>{formatCurrency(totalInterest)}</TableCell>
                        <TableCell className="font-bold">{formatCurrency(totalPrincipal + totalInterest)}</TableCell>
                        <TableCell colSpan={3} />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
