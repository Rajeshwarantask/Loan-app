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
  loan_amount: number
  interest_rate: number
  status: string
  created_at: string // changed from requested_at
  remaining_balance?: number
  profiles: {
    full_name: string
    email: string
    member_id: string | null
  }
  user_id: string
  member_id?: string
  loan_balance?: number
  monthly_emi?: number
  emi_monthly_interest?: number
  emi_balance?: number
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
          .select("payment_date")
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
    <div className="overflow-x-auto -mx-2 md:mx-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-2 md:px-4">ID</TableHead>
            <TableHead className="px-2 md:px-4">User</TableHead>
            <TableHead className="px-2 md:px-4">Total Loan</TableHead>
            <TableHead className="px-2 md:px-4">Principal</TableHead>
            <TableHead className="px-2 md:px-4 hidden md:table-cell">Rate</TableHead>
            <TableHead className="px-2 md:px-4">Status</TableHead>
            <TableHead className="px-2 md:px-4 hidden md:table-cell">Record</TableHead>
            <TableHead className="text-right px-2 md:px-4">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loans.map((loan) => {
            const recordStatus = recordStatusMap[loan.id]
            const principalRemaining = loan.remaining_balance ?? loan.loan_amount

            return (
              <TableRow key={loan.id}>
                <TableCell className="font-medium px-2 md:px-4">{loan.profiles.member_id || "N/A"}</TableCell>
                <TableCell className="px-2 md:px-4">
                  <div className="font-medium">{loan.profiles.full_name}</div>
                </TableCell>
                <TableCell className="font-semibold px-2 md:px-4">{formatCurrency(loan.loan_amount)}</TableCell>
                <TableCell className="font-semibold px-2 md:px-4">{formatCurrency(principalRemaining)}</TableCell>
                <TableCell className="px-2 md:px-4 hidden md:table-cell">{loan.interest_rate}%</TableCell>
                <TableCell className="px-2 md:px-4">
                  <Badge
                    variant={
                      loan.status === "active"
                        ? "default"
                        : loan.status === "completed" || loan.status === "closed"
                          ? "secondary"
                          : "destructive"
                    }
                    className="px-2"
                  >
                    {loan.status}
                  </Badge>
                </TableCell>
                <TableCell className="px-2 md:px-4 hidden md:table-cell">
                  {recordStatus?.marked ? (
                    <Badge variant="default" className="bg-green-600 px-2">
                      Marked — {recordStatus.monthYear}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="px-2">
                      Not marked
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right px-2 md:px-4">
                  <div className="flex flex-col md:flex-row items-end md:items-center justify-end gap-1 md:gap-2">
                    <Dialog
                      open={loanDetailsOpen && selectedLoan?.id === loan.id}
                      onOpenChange={(open) => {
                        setLoanDetailsOpen(open)
                        if (!open) setSelectedLoan(null)
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLoan(loan)}>
                          <Eye className="h-4 w-4 mr-0 md:mr-1" />
                          <span className="hidden md:inline">View</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[95vw] md:max-w-md">
                        <DialogHeader>
                          <DialogTitle className="text-sm md:text-base">Loan Details</DialogTitle>
                        </DialogHeader>
                        {selectedLoan && (
                          <div className="space-y-3 md:space-y-4 py-2 md:py-4">
                            <div className="grid grid-cols-2 gap-2 md:gap-4">
                              <div>
                                <div className="text-sm font-medium text-muted-foreground">Borrower</div>
                                <div className="font-semibold">{selectedLoan.profiles.full_name}</div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-muted-foreground">Email</div>
                                <div className="text-sm">{selectedLoan.profiles.email}</div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-muted-foreground">Total Loan Taken</div>
                                <div className="text-lg font-bold">
                                  {formatCurrency(Number(selectedLoan.loan_amount))}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-muted-foreground">Principal Remaining</div>
                                <div className="text-lg font-bold">
                                  {formatCurrency(selectedLoan.remaining_balance ?? selectedLoan.loan_amount)}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-muted-foreground">Interest Rate</div>
                                <div className="text-lg font-bold">{selectedLoan.interest_rate}%</div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-muted-foreground">Monthly Interest</div>
                                <div className="font-semibold">
                                  {formatCurrency(
                                    Math.round(
                                      ((selectedLoan.remaining_balance ?? selectedLoan.loan_amount) *
                                        selectedLoan.interest_rate) /
                                        100,
                                    ),
                                  )}
                                </div>
                              </div>
                              {selectedLoan.monthly_emi && selectedLoan.monthly_emi > 0 ? (
                                <>
                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">Monthly EMI</div>
                                    <div className="font-semibold">
                                      {formatCurrency(Number(selectedLoan.monthly_emi))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-muted-foreground">EMI Interest</div>
                                    <div className="font-semibold">
                                      {formatCurrency(Number(selectedLoan.emi_monthly_interest || 0))}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="col-span-2">
                                  <Badge variant="outline" className="text-muted-foreground text-sm">
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
                                  className="text-xs"
                                >
                                  {selectedLoan.status}
                                </Badge>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-muted-foreground">Created Date</div>
                                <div className="text-sm">
                                  {format(new Date(selectedLoan.created_at), "MMM dd, yyyy")}
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
