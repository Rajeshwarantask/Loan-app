"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils/loan-calculator"
import { format, differenceInMonths } from "date-fns"
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

  const calculateLoanDuration = (loan: Loan, loanPayments: LoanPayment[]) => {
    const startDate = new Date(loan.requested_at)

    // If loan is completed, use the last payment date as end date
    if (loan.status === "completed" && loanPayments.length > 0) {
      const lastPayment = loanPayments[loanPayments.length - 1]
      const endDate = new Date(lastPayment.payment_date || lastPayment.month_year)
      const months = differenceInMonths(endDate, startDate)
      return Math.max(months, 1) // Minimum 1 month
    }

    // If loan is still active, calculate from start to now
    const months = differenceInMonths(new Date(), startDate)
    return Math.max(months, 1) // Minimum 1 month
  }

  if (loanGroups.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No payment history found</div>
  }

  return (
    <div className="space-y-2 md:space-y-4">
      {loanGroups.map(({ loan, payments: loanPayments }) => {
        const isExpanded = expandedLoan === loan.id
        const totalPrincipal = loanPayments.reduce((sum, p) => sum + p.principal_paid, 0)
        const totalInterest = loanPayments.reduce((sum, p) => sum + p.interest_paid, 0)
        const actualDuration = calculateLoanDuration(loan, loanPayments)

        return (
          <Card key={loan.id} className="overflow-hidden">
            <CardHeader
              className="cursor-pointer hover:bg-muted/50 transition-colors px-3 md:px-6 py-3 md:py-6"
              onClick={() => setExpandedLoan(isExpanded ? null : loan.id)}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <CardTitle className="text-sm md:text-base">
                      {loan.profiles.member_id ? `${loan.profiles.member_id} - ` : ""}
                      {loan.profiles.full_name}
                    </CardTitle>
                  </div>
                  <div className="text-sm text-muted-foreground flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
                    <span>Loan: {formatCurrency(loan.amount)}</span>
                    <span>Rate: {loan.interest_rate}%</span>
                    <span>Duration: {actualDuration}m</span>
                    <Badge variant={loan.status === "active" ? "default" : "secondary"} className="w-fit">
                      {loan.status}
                    </Badge>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">{loanPayments.length} pays</div>
                  <div className="text-muted-foreground">{formatCurrency(totalPrincipal + totalInterest)}</div>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 px-2 md:px-6 pb-3 md:pb-6">
                <div className="rounded-md border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="px-2 md:px-4">Month</TableHead>
                          <TableHead className="px-2 md:px-4">Principal</TableHead>
                          <TableHead className="px-2 md:px-4">Interest</TableHead>
                          <TableHead className="px-2 md:px-4 hidden md:table-cell">Total</TableHead>
                          <TableHead className="px-2 md:px-4 hidden lg:table-cell">Balance</TableHead>
                          <TableHead className="px-2 md:px-4 hidden md:table-cell">Status</TableHead>
                          <TableHead className="px-2 md:px-4 hidden lg:table-cell">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loanPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium px-2 md:px-4">{payment.month_year}</TableCell>
                            <TableCell className="px-2 md:px-4">{formatCurrency(payment.principal_paid)}</TableCell>
                            <TableCell className="px-2 md:px-4">{formatCurrency(payment.interest_paid)}</TableCell>
                            <TableCell className="font-semibold px-2 md:px-4 hidden md:table-cell">
                              {formatCurrency(payment.principal_paid + payment.interest_paid)}
                            </TableCell>
                            <TableCell className="px-2 md:px-4 hidden lg:table-cell">
                              {formatCurrency(payment.remaining_balance)}
                            </TableCell>
                            <TableCell className="px-2 md:px-4 hidden md:table-cell">
                              <Badge variant={payment.status === "paid" ? "default" : "secondary"} className="text-sm">
                                {payment.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-2 md:px-4 hidden lg:table-cell">
                              {payment.payment_date ? format(new Date(payment.payment_date), "MMM dd, yyyy") : "N/A"}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-medium">
                          <TableCell className="px-2 md:px-4">Total</TableCell>
                          <TableCell className="px-2 md:px-4">{formatCurrency(totalPrincipal)}</TableCell>
                          <TableCell className="px-2 md:px-4">{formatCurrency(totalInterest)}</TableCell>
                          <TableCell className="font-bold px-2 md:px-4 hidden md:table-cell">
                            {formatCurrency(totalPrincipal + totalInterest)}
                          </TableCell>
                          <TableCell colSpan={3} />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
