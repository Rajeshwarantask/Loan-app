"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils/loan-calculator"
import { format } from "date-fns"
import { useState, useMemo } from "react"
import { Eye } from "lucide-react"

interface Profile {
  id: string
  full_name: string
  email: string
  member_id: string | null
}

interface Loan {
  id: string
  user_id: string
  loan_amount: number
  interest_rate: number
  status: string
  created_at: string
  profiles: Profile
}

interface LoanPayment {
  id: string
  loan_id: string
  user_id: string
  interest_paid: number
  principal_paid: number
  month_year: string
  payment_date: string | null
}

interface UserLoanSummaryTableProps {
  loans: Loan[]
  payments: LoanPayment[]
}

interface UserSummary {
  userId: string
  memberIdDisplay: string
  userName: string
  email: string
  totalLoanAmount: number
  totalInterestPaid: number
  loanHistory: Array<{
    loanId: string
    amount: number
    interestRate: number
    status: string
    createdDate: string
    payments: LoanPayment[]
  }>
}

export function UserLoanSummaryTable({ loans, payments }: UserLoanSummaryTableProps) {
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const userSummaries = useMemo(() => {
    const userMap = new Map<string, UserSummary>()

    loans.forEach((loan) => {
      if (!userMap.has(loan.user_id)) {
        const memberIdDisplay = loan.profiles.member_id || `user-${loan.user_id.substring(0, 8)}`

        userMap.set(loan.user_id, {
          userId: loan.user_id,
          memberIdDisplay,
          userName: loan.profiles.full_name,
          email: loan.profiles.email,
          totalLoanAmount: 0,
          totalInterestPaid: 0,
          loanHistory: [],
        })
      }

      const userSummary = userMap.get(loan.user_id)!
      userSummary.totalLoanAmount += Number(loan.loan_amount)

      const loanPayments = payments.filter((p) => p.loan_id === loan.id)
      const loanInterestPaid = loanPayments.reduce((sum, p) => sum + Number(p.interest_paid || 0), 0)
      userSummary.totalInterestPaid += loanInterestPaid

      userSummary.loanHistory.push({
        loanId: loan.id,
        amount: Number(loan.loan_amount),
        interestRate: loan.interest_rate,
        status: loan.status,
        createdDate: loan.created_at,
        payments: loanPayments,
      })
    })

    return Array.from(userMap.values()).sort((a, b) => {
      const aId = a.memberIdDisplay
      const bId = b.memberIdDisplay

      const aMatch = aId.match(/^V(\d+)$/)
      const bMatch = bId.match(/^V(\d+)$/)

      if (aMatch && bMatch) {
        return Number.parseInt(aMatch[1]) - Number.parseInt(bMatch[1])
      }

      return aId.localeCompare(bId)
    })
  }, [loans, payments])

  return (
    <div className="overflow-x-auto">
      {userSummaries.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <p>No loan data found</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Total Loan Amount</TableHead>
              <TableHead>Total Interest Paid</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {userSummaries.map((userSummary) => (
              <TableRow key={userSummary.userId} className="hover:bg-muted/50">
                <TableCell>
                  <Badge variant="outline" className="font-mono">
                    {userSummary.memberIdDisplay}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{userSummary.userName}</div>
                  <div className="text-sm text-muted-foreground">{userSummary.email}</div>
                </TableCell>
                <TableCell className="font-semibold text-lg">{formatCurrency(userSummary.totalLoanAmount)}</TableCell>
                <TableCell className="font-semibold text-lg text-green-600">
                  {formatCurrency(userSummary.totalInterestPaid)}
                </TableCell>
                <TableCell className="text-right">
                  <Dialog
                    open={detailsOpen && selectedUser?.userId === userSummary.userId}
                    onOpenChange={(open) => {
                      setDetailsOpen(open)
                      if (!open) setSelectedUser(null)
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setSelectedUser(userSummary)} className="h-8">
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Consolidated Loan History - {userSummary.userName}</DialogTitle>
                      </DialogHeader>
                      {selectedUser && (
                        <div className="space-y-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                              <div className="text-sm font-medium text-muted-foreground">Member ID</div>
                              <div className="text-2xl font-bold">{selectedUser.memberIdDisplay}</div>
                            </div>
                            <div className="p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/20">
                              <div className="text-sm font-medium text-muted-foreground">Total Loans</div>
                              <div className="text-2xl font-bold">{formatCurrency(selectedUser.totalLoanAmount)}</div>
                            </div>
                            <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                              <div className="text-sm font-medium text-muted-foreground">Total Interest Paid</div>
                              <div className="text-2xl font-bold text-green-600">
                                {formatCurrency(selectedUser.totalInterestPaid)}
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-lg font-semibold mb-4">All Loans</h3>
                            <div className="space-y-4">
                              {selectedUser.loanHistory.map((loan) => {
                                const totalPrincipalPaid = loan.payments.reduce(
                                  (sum, p) => sum + Number(p.principal_paid || 0),
                                  0,
                                )
                                const totalInterestPaid = loan.payments.reduce(
                                  (sum, p) => sum + Number(p.interest_paid || 0),
                                  0,
                                )

                                return (
                                  <div key={loan.loanId} className="border rounded-lg p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="font-semibold text-lg">{formatCurrency(loan.amount)}</div>
                                        <div className="text-sm text-muted-foreground">
                                          Created: {format(new Date(loan.createdDate), "MMM dd, yyyy")}
                                        </div>
                                      </div>
                                      <Badge
                                        variant={loan.status === "completed" ? "default" : "secondary"}
                                        className={
                                          loan.status === "completed"
                                            ? "bg-green-100 text-green-700 border-green-200"
                                            : ""
                                        }
                                      >
                                        {loan.status}
                                      </Badge>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                      <div>
                                        <div className="text-muted-foreground">Interest Rate</div>
                                        <div className="font-semibold">{loan.interestRate}%</div>
                                      </div>
                                      <div>
                                        <div className="text-muted-foreground">Principal Paid</div>
                                        <div className="font-semibold">{formatCurrency(totalPrincipalPaid)}</div>
                                      </div>
                                      <div>
                                        <div className="text-muted-foreground">Interest Paid</div>
                                        <div className="font-semibold text-green-600">
                                          {formatCurrency(totalInterestPaid)}
                                        </div>
                                      </div>
                                    </div>

                                    {loan.payments.length > 0 && (
                                      <div className="mt-3 pt-3 border-t">
                                        <div className="text-sm font-medium mb-2">Payment Records</div>
                                        <div className="space-y-2">
                                          {loan.payments.map((payment) => (
                                            <div
                                              key={payment.id}
                                              className="flex justify-between items-center text-sm bg-muted/30 p-2 rounded"
                                            >
                                              <div>
                                                <div className="font-medium">{payment.month_year}</div>
                                                {payment.payment_date && (
                                                  <div className="text-xs text-muted-foreground">
                                                    {format(new Date(payment.payment_date), "MMM dd, yyyy")}
                                                  </div>
                                                )}
                                              </div>
                                              <div className="text-right">
                                                <div>Principal: {formatCurrency(Number(payment.principal_paid))}</div>
                                                <div className="text-green-600">
                                                  Interest: {formatCurrency(Number(payment.interest_paid))}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
