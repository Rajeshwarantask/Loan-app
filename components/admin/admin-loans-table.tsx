"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils/loan-calculator"
import { format } from "date-fns"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Eye } from "lucide-react"
import { RecordPaymentUnifiedDialog } from "./record-payment-unified-dialog"

interface Loan {
  id: string
  amount: number
  interest_rate: number
  duration_months: number
  status: string
  requested_at: string
  principal_remaining?: number
  outstanding_interest?: number
  profiles: {
    full_name: string
    email: string
  }
  user_id: string
  loan_balance?: number
  monthly_emi_amount?: number
  emi_monthly_interest?: number
  emi_balance?: number
  installment_duration_months?: number
}

interface AdminLoansTableProps {
  loans: Loan[]
}

interface InterestStatus {
  marked: boolean
  monthYear: string
}

export function AdminLoansTable({ loans }: AdminLoansTableProps) {
  const [recordStatusMap, setRecordStatusMap] = useState<Record<string, InterestStatus>>({})
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [loanDetailsOpen, setLoanDetailsOpen] = useState(false)

  useEffect(() => {
    const checkPaymentRecords = async () => {
      const supabase = createClient()
      const now = new Date()
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()

      const statusMap: Record<string, InterestStatus> = {}

      for (const loan of loans) {
        const firstDay = new Date(currentYear, currentMonth - 1, 1).toISOString().split("T")[0]
        const lastDay = new Date(currentYear, currentMonth, 0).toISOString().split("T")[0]

        const { data: payments } = await supabase
          .from("loan_payments")
          .select("payment_date, payment_type")
          .eq("loan_id", loan.id)
          .gte("payment_date", firstDay)
          .lte("payment_date", lastDay)
          .limit(1)

        if (payments && payments.length > 0) {
          const paymentDate = new Date(payments[0].payment_date)
          const monthYear = paymentDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })
          statusMap[loan.id] = { marked: true, monthYear }
        } else {
          statusMap[loan.id] = { marked: false, monthYear: "" }
        }
      }

      setRecordStatusMap(statusMap)
    }

    if (loans.length > 0) {
      checkPaymentRecords()
    }
  }, [loans])

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Principal Balance</TableHead>
            <TableHead>Interest Rate</TableHead>
            <TableHead>Record Status</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loans.map((loan) => {
            const recordStatus = recordStatusMap[loan.id]
            const principalRemaining = loan.principal_remaining ?? loan.amount

            return (
              <TableRow key={loan.id}>
                <TableCell>
                  <div className="font-medium">{loan.profiles.full_name}</div>
                </TableCell>
                <TableCell className="font-semibold">{formatCurrency(principalRemaining)}</TableCell>
                <TableCell>{loan.interest_rate}%</TableCell>
                <TableCell>
                  {recordStatus?.marked ? (
                    <Badge variant="default" className="bg-green-600">
                      Marked — {recordStatus.monthYear}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not marked</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      loan.status === "active"
                        ? "default"
                        : loan.status === "completed" || loan.status === "closed"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {loan.status}
                  </Badge>
                </TableCell>
                <TableCell>{format(new Date(loan.requested_at), "MMM dd, yyyy")}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Dialog
                      open={loanDetailsOpen && selectedLoan?.id === loan.id}
                      onOpenChange={(open) => {
                        setLoanDetailsOpen(open)
                        if (!open) setSelectedLoan(null)
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLoan(loan)} className="h-8">
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Loan Details</DialogTitle>
                        </DialogHeader>
                        {selectedLoan && (
                          <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm font-medium text-muted-foreground">Borrower</div>
                                <div className="text-base font-semibold">{selectedLoan.profiles.full_name}</div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-muted-foreground">Email</div>
                                <div className="text-sm">{selectedLoan.profiles.email}</div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-muted-foreground">Original Amount</div>
                                <div className="text-lg font-bold">{formatCurrency(Number(selectedLoan.amount))}</div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-muted-foreground">Principal Remaining</div>
                                <div className="text-lg font-bold">
                                  {formatCurrency(selectedLoan.principal_remaining ?? selectedLoan.amount)}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-muted-foreground">Interest Rate</div>
                                <div className="text-lg font-bold">{selectedLoan.interest_rate}%</div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-muted-foreground">Monthly Interest</div>
                                <div className="text-base font-semibold">
                                  {formatCurrency(
                                    Math.round(
                                      ((selectedLoan.principal_remaining ?? selectedLoan.amount) *
                                        selectedLoan.interest_rate) /
                                        100,
                                    ),
                                  )}
                                </div>
                              </div>
                              {selectedLoan.monthly_emi_amount && selectedLoan.monthly_emi_amount > 0 ? (
                                <>
                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">Monthly EMI</div>
                                    <div className="text-base font-semibold">
                                      {formatCurrency(Number(selectedLoan.monthly_emi_amount))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">EMI Interest</div>
                                    <div className="text-base font-semibold">
                                      {formatCurrency(Number(selectedLoan.emi_monthly_interest || 0))}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="col-span-2">
                                  <Badge variant="outline" className="text-muted-foreground">
                                    EMI details not configured yet
                                  </Badge>
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-medium text-muted-foreground">Status</div>
                                <Badge
                                  variant={
                                    selectedLoan.status === "active"
                                      ? "default"
                                      : selectedLoan.status === "completed" || selectedLoan.status === "closed"
                                        ? "secondary"
                                        : "destructive"
                                  }
                                >
                                  {selectedLoan.status}
                                </Badge>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-muted-foreground">Requested Date</div>
                                <div className="text-sm">
                                  {format(new Date(selectedLoan.requested_at), "MMM dd, yyyy")}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    <RecordPaymentUnifiedDialog loan={loan} isMarked={recordStatus?.marked ?? false} />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
