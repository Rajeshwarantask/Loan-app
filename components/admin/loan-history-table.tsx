"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { VerificationMismatchDialog } from "@/components/admin/verification-mismatch-dialog"
import { formatCurrency } from "@/lib/utils/loan-calculator"
import { format, differenceInMonths } from "date-fns"
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface LoanPayment {
  id: string
  loan_id: string
  user_id: string
  month_year: string
  additional_principal: number
  interest_paid: number
  remaining_balance: number
  status: string
  payment_date: string | null
  monthly_emi: number | null
  monthly_subscription: number | null
  period_key: string
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
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [mismatchDialog, setMismatchDialog] = useState<{
    isOpen: boolean
    periodKey: string
    method1Value: number
    method2Value: number
    pendingPayment: LoanPayment | null
    selectedMethod: 1 | 2 | null
  }>({
    isOpen: false,
    periodKey: "",
    method1Value: 0,
    method2Value: 0,
    pendingPayment: null,
    selectedMethod: null,
  })

  const loanGroups = useMemo(() => {
    const groups = new Map<string, { loan: Loan; payments: LoanPayment[] }>()

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

    if (loan.status === "completed" && loanPayments.length > 0) {
      const lastPayment = loanPayments[loanPayments.length - 1]
      const endDate = new Date(lastPayment.payment_date || lastPayment.month_year)
      const months = differenceInMonths(endDate, startDate)
      return Math.max(months, 1)
    }

    const months = differenceInMonths(new Date(), startDate)
    return Math.max(months, 1)
  }

  const handleDeletePayment = async (payment: LoanPayment) => {
    setIsDeleting(true)
    const supabase = createClient()

    try {
      // Fetch current loans.loan_amount, original_loan_amount and payment details
      const { data: loanData, error: loanFetchError } = await supabase
        .from("loans")
        .select("loan_amount, original_loan_amount, status")
        .eq("id", payment.loan_id)
        .single()

      if (loanFetchError) throw loanFetchError

      const { data: paymentDetails, error: paymentFetchError } = await supabase
        .from("loan_payments")
        .select("additional_principal, monthly_emi, period_key, period_year, period_month, remaining_balance")
        .eq("id", payment.id)
        .single()

      if (paymentFetchError) throw paymentFetchError

      // Fetch the new_loan_amount from additional_loan table for this period
      const { data: additionalLoanData } = await supabase
        .from("additional_loan")
        .select("additional_loan_amount")
        .eq("user_id", payment.user_id)
        .eq("period_key", paymentDetails.period_key)
        .maybeSingle()

      const newLoanAmount = additionalLoanData?.additional_loan_amount || 0

      // Find the PREVIOUS period's closing balance (which is the opening for this period being deleted)
      let restoredBalance = 0
      const { data: previousPayment } = await supabase
        .from("loan_payments")
        .select("remaining_balance, period_key")
        .eq("user_id", payment.user_id)
        .lt("period_key", paymentDetails.period_key)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false })
        .limit(1)
        .single()

      if (previousPayment) {
        // METHOD 1: Trust source of truth - use previous payment's closing balance
        const method1_openingBalance = previousPayment.remaining_balance

        // METHOD 2: Recalculate using formula: opening = THIS_MONTH_closing + EMI + principal - new_loan
        const method2_openingBalance =
          (paymentDetails.remaining_balance || 0) +
          (paymentDetails.monthly_emi || 0) +
          (paymentDetails.additional_principal || 0) -
          newLoanAmount

        console.log("[v0] REVERT: Balance Verification for period:", paymentDetails.period_key)
        console.log("[v0] METHOD 1 (Direct - previous closing balance):", method1_openingBalance)
        console.log("[v0] METHOD 2 (Recalculated from current closing):", method2_openingBalance)
        console.log("[v0]   - Previous closing:", previousPayment.remaining_balance)
        console.log("[v0]   - Current closing:", paymentDetails.remaining_balance)
        console.log("[v0]   - Current EMI:", paymentDetails.monthly_emi)
        console.log("[v0]   - Current principal:", paymentDetails.additional_principal)
        console.log("[v0]   - Current new_loan:", newLoanAmount)

        // Both methods must match when previous data exists - this is a data integrity check
        if (Math.abs(method1_openingBalance - method2_openingBalance) > 0.01) {
          console.warn("[v0] DATA INTEGRITY ISSUE: Balance methods mismatch!")
          console.warn("[v0] Discrepancy:", Math.abs(method1_openingBalance - method2_openingBalance))
          
          // Show dialog for user to choose
          setMismatchDialog({
            isOpen: true,
            periodKey: paymentDetails.period_key,
            method1Value: method1_openingBalance,
            method2Value: method2_openingBalance,
            pendingPayment: payment,
            selectedMethod: null,
          })
          setIsDeleting(false)
          return
        }

        console.log("[v0] VERIFICATION PASSED: Both methods match ✓")
        restoredBalance = method1_openingBalance
      } else {
        // Edge case: No prior payment - this is the first period for this loan
        // Use original_loan_amount as checkpoint for fresh start
        const method1_checkpoint = loanData.original_loan_amount || loanData.loan_amount

        // METHOD 2: Calculate what opening should be from current month data
        const method2_calculated =
          (paymentDetails.remaining_balance || 0) +
          (paymentDetails.monthly_emi || 0) +
          (paymentDetails.additional_principal || 0) -
          newLoanAmount

        console.log("[v0] REVERT: First Period (Edge Case) - Using original_loan_amount checkpoint")
        console.log("[v0] CHECKPOINT (original_loan_amount):", method1_checkpoint)
        console.log("[v0] CALCULATED (from current data):", method2_calculated)
        console.log("[v0]   - Current closing:", paymentDetails.remaining_balance)
        console.log("[v0]   - Current EMI:", paymentDetails.monthly_emi)
        console.log("[v0]   - Current principal:", paymentDetails.additional_principal)
        console.log("[v0]   - Current new_loan:", newLoanAmount)

        // Verify checkpoint matches calculation as sanity check
        if (Math.abs(method1_checkpoint - method2_calculated) > 0.01) {
          console.warn("[v0] EDGE CASE: Checkpoint and calculation differ slightly")
          console.warn("[v0] Difference:", Math.abs(method1_checkpoint - method2_calculated))
        } else {
          console.log("[v0] CHECKPOINT VERIFIED: Fresh start confirmed ✓")
        }

        // Use checkpoint for fresh start
        restoredBalance = method1_checkpoint
      }

      // Delete the payment record first
      const { error: deletePaymentError } = await supabase.from("loan_payments").delete().eq("id", payment.id)

      if (deletePaymentError) throw deletePaymentError

      console.log("[v0] Payment deleted successfully. Restored balance:", restoredBalance)

      // Delete associated additional_loan if it exists
      if (additionalLoanData) {
        const { error: deleteAdditionalLoanError } = await supabase
          .from("additional_loan")
          .delete()
          .eq("user_id", payment.user_id)
          .eq("period_key", paymentDetails.period_key)

        if (deleteAdditionalLoanError) throw deleteAdditionalLoanError
      }

      // Delete associated additional_loan if it exists
      if (additionalLoanData) {
        const { error: deleteAdditionalLoanError } = await supabase
          .from("additional_loan")
          .delete()
          .eq("id", additionalLoanData.id)

        if (deleteAdditionalLoanError) throw deleteAdditionalLoanError
      }

      // Also delete any penalties that were recorded for this payment
      const { error: deletePenaltyError } = await supabase
        .from("penalties")
        .delete()
        .eq("loan_payment_id", payment.id)

      if (deletePenaltyError) {
        console.warn("[v0] Warning: Failed to delete penalties:", deletePenaltyError)
        // Don't throw - penalty deletion is not critical
      }

      // Now recalculate all subsequent payments to ensure data integrity
      const { data: subsequentPayments } = await supabase
        .from("loan_payments")
        .select("*")
        .eq("loan_id", payment.loan_id)
        .gt("period_key", paymentDetails.period_key)
        .order("period_year", { ascending: true })
        .order("period_month", { ascending: true })

      if (subsequentPayments && subsequentPayments.length > 0) {
        console.log("[v0] Recalculating", subsequentPayments.length, "subsequent payments...")
        let currentOpeningBalance = restoredBalance

        for (const subsequentPayment of subsequentPayments) {
          // Calculate the corrected closing balance
          const correctedClosingBalance = Math.max(
            0,
            currentOpeningBalance - (subsequentPayment.monthly_emi || 0) - (subsequentPayment.additional_principal || 0),
          )

          console.log(
            "[v0] Recalc period",
            subsequentPayment.period_key,
            "- Opening:",
            currentOpeningBalance,
            "EMI:",
            subsequentPayment.monthly_emi,
            "Principal:",
            subsequentPayment.additional_principal,
            "Closing:",
            correctedClosingBalance,
          )

          // Update the subsequent payment with corrected closing balance
          const { error: updateError } = await supabase
            .from("loan_payments")
            .update({
              remaining_balance: correctedClosingBalance,
            })
            .eq("id", subsequentPayment.id)

          if (updateError) throw updateError

          // Next payment's opening becomes this payment's closing
          currentOpeningBalance = correctedClosingBalance
        }
        console.log("[v0] All subsequent payments recalculated successfully")
      }

      // Restore loans.loan_amount to what it was before this payment was made
      const shouldBeActive = restoredBalance > 0

      const { error: updateLoanError } = await supabase
        .from("loans")
        .update({
          loan_amount: Math.max(0, restoredBalance),
          status: shouldBeActive ? "active" : loanData.status,
        })
        .eq("id", payment.loan_id)

      if (updateLoanError) throw updateLoanError

      toast.success("Payment deleted successfully", {
        description: "The payment has been removed and all subsequent months have been recalculated.",
      })

      window.location.reload()
    } catch (error) {
      console.error("[v0] Error deleting payment:", error)
      toast.error("Failed to delete payment", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      })
    } finally {
      setIsDeleting(false)
      setDeletePaymentId(null)
    }
  }

  const continueDeletePaymentWithMethod = async (payment: LoanPayment, selectedMethod: 1 | 2) => {
    const supabase = createClient()

    try {
      // Re-fetch necessary data
      const { data: paymentDetails } = await supabase
        .from("loan_payments")
        .select("additional_principal, monthly_emi, period_key, period_year, period_month, remaining_balance")
        .eq("id", payment.id)
        .single()

      if (!paymentDetails) throw new Error("Payment details not found")

      const { data: additionalLoanData } = await supabase
        .from("additional_loan")
        .select("additional_loan_amount")
        .eq("user_id", payment.user_id)
        .eq("period_key", paymentDetails.period_key)
        .maybeSingle()

      const newLoanAmount = additionalLoanData?.additional_loan_amount || 0

      // Get previous payment
      const { data: previousPayment } = await supabase
        .from("loan_payments")
        .select("remaining_balance")
        .eq("user_id", payment.user_id)
        .lt("period_key", paymentDetails.period_key)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false })
        .limit(1)
        .single()

      let restoredBalance = 0

      if (selectedMethod === 1) {
        restoredBalance = previousPayment?.remaining_balance || 0
        console.log("[v0] User selected METHOD 1: Using previous closing balance:", restoredBalance)
      } else {
        restoredBalance =
          (paymentDetails.remaining_balance || 0) +
          (paymentDetails.monthly_emi || 0) +
          (paymentDetails.additional_principal || 0) -
          newLoanAmount
        console.log("[v0] User selected METHOD 2: Using calculated opening balance:", restoredBalance)
      }

      // Now perform the deletion with the selected balance
      const { error: deletePaymentError } = await supabase.from("loan_payments").delete().eq("id", payment.id)
      if (deletePaymentError) throw deletePaymentError

      if (additionalLoanData) {
        const { error: deleteAdditionalLoanError } = await supabase
          .from("additional_loan")
          .delete()
          .eq("user_id", payment.user_id)
          .eq("period_key", paymentDetails.period_key)
        if (deleteAdditionalLoanError) throw deleteAdditionalLoanError
      }

      const { error: deletePenaltyError } = await supabase.from("penalties").delete().eq("loan_payment_id", payment.id)
      if (deletePenaltyError) console.warn("[v0] Warning: Failed to delete penalties:", deletePenaltyError)

      // Recalculate subsequent payments
      const { data: subsequentPayments } = await supabase
        .from("loan_payments")
        .select("*")
        .eq("loan_id", payment.loan_id)
        .gt("period_key", paymentDetails.period_key)
        .order("period_year", { ascending: true })
        .order("period_month", { ascending: true })

      if (subsequentPayments && subsequentPayments.length > 0) {
        let currentOpeningBalance = restoredBalance
        for (const subsequentPayment of subsequentPayments) {
          const newOpeningBalance = currentOpeningBalance
          const newClosingBalance = newOpeningBalance - (subsequentPayment.monthly_emi || 0) - (subsequentPayment.additional_principal || 0) + newLoanAmount

          const { error: updateError } = await supabase
            .from("loan_payments")
            .update({ remaining_balance: newClosingBalance })
            .eq("id", subsequentPayment.id)

          if (updateError) throw updateError
          currentOpeningBalance = newClosingBalance
        }
      }

      // Update loan status
      const { error: updateLoanError } = await supabase
        .from("loans")
        .update({ loan_amount: restoredBalance })
        .eq("id", payment.loan_id)

      if (updateLoanError) throw updateLoanError

      toast.success("Payment deleted successfully", {
        description: `Used ${selectedMethod === 1 ? "METHOD 1 (Previous Closing)" : "METHOD 2 (Calculated Opening)"} - All subsequent months recalculated.`,
      })

      window.location.reload()
    } catch (error) {
      console.error("[v0] Error completing deletion:", error)
      toast.error("Failed to complete deletion", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      })
      setIsDeleting(false)
    }
  }

  if (loanGroups.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No payment history found</div>
  }

  return (
    <>
      <div className="space-y-2 md:space-y-4">
        {loanGroups.map(({ loan, payments: loanPayments }) => {
          const isExpanded = expandedLoan === loan.id
          const totalPrincipal = loanPayments.reduce((sum, p) => sum + (p.additional_principal || 0), 0)
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
                      <span>Loan: {formatCurrency(loan.loan_amount || 0)}</span>
                      <span>Rate: {loan.interest_rate || 0}%</span>
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
                            <TableHead className="px-2 md:px-4">EMI</TableHead>
                            <TableHead className="px-2 md:px-4 hidden sm:table-cell">Principal</TableHead>
                            <TableHead className="px-2 md:px-4">Interest</TableHead>
                            <TableHead className="px-2 md:px-4 hidden md:table-cell">Subscription</TableHead>
                            <TableHead className="font-semibold px-2 md:px-4 hidden md:table-cell">Total</TableHead>
                            <TableHead className="px-2 md:px-4 hidden lg:table-cell">Balance</TableHead>
                            <TableHead className="px-2 md:px-4 hidden md:table-cell">Status</TableHead>
                            <TableHead className="px-2 md:px-4 hidden lg:table-cell">Period</TableHead>
                            <TableHead className="px-2 md:px-4">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loanPayments.map((payment) => {
                            const emi = payment.monthly_emi || 0
                            const additionalPrincipal = payment.additional_principal || 0
                            const subscription = payment.monthly_subscription || 0
                            const totalPayment = emi + payment.interest_paid + subscription
                            
                            return (
                              <TableRow key={payment.id}>
                                <TableCell className="font-medium px-2 md:px-4">{formatCurrency(emi)}</TableCell>
                                <TableCell className="px-2 md:px-4 hidden sm:table-cell">
                                  {formatCurrency(additionalPrincipal)}
                                </TableCell>
                                <TableCell className="px-2 md:px-4">{formatCurrency(payment.interest_paid)}</TableCell>
                                <TableCell className="px-2 md:px-4 hidden md:table-cell">{formatCurrency(subscription)}</TableCell>
                                <TableCell className="font-semibold px-2 md:px-4 hidden md:table-cell">
                                  {formatCurrency(totalPayment)}
                                </TableCell>
                                <TableCell className="px-2 md:px-4 hidden lg:table-cell">
                                  {formatCurrency(payment.remaining_balance)}
                                </TableCell>
                                <TableCell className="px-2 md:px-4 hidden md:table-cell">
                                  <Badge
                                    variant={payment.status === "paid" ? "default" : "secondary"}
                                    className="text-sm"
                                  >
                                    {payment.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="px-2 md:px-4 hidden lg:table-cell">
                                  {payment.period_key ? `${payment.period_key}` : "N/A"}
                                </TableCell>
                                <TableCell className="px-2 md:px-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setDeletePaymentId(payment.id)
                                    }}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                          {(() => {
                            const totalEMI = loanPayments.reduce((sum, p) => sum + (p.monthly_emi || 0), 0)
                            const totalAdditionalPrincipal = loanPayments.reduce(
                              (sum, p) => sum + (p.additional_principal || 0),
                              0,
                            )
                            const totalSubscription = loanPayments.reduce(
                              (sum, p) => sum + (p.monthly_subscription || 0),
                              0,
                            )
                            const grandTotal = totalEMI + totalInterest + totalSubscription

                            return (
                              <TableRow className="bg-muted/50 font-medium">
                                <TableCell className="px-2 md:px-4">{formatCurrency(totalEMI)}</TableCell>
                                <TableCell className="px-2 md:px-4 hidden sm:table-cell">
                                  {formatCurrency(totalAdditionalPrincipal)}
                                </TableCell>
                                <TableCell className="px-2 md:px-4">{formatCurrency(totalInterest)}</TableCell>
                                <TableCell className="px-2 md:px-4 hidden md:table-cell">
                                  {formatCurrency(totalSubscription)}
                                </TableCell>
                                <TableCell className="font-bold px-2 md:px-4 hidden md:table-cell">
                                  {formatCurrency(grandTotal)}
                                </TableCell>
                                <TableCell colSpan={4} />
                              </TableRow>
                            )
                          })()}
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

      <AlertDialog open={deletePaymentId !== null} onOpenChange={(open) => !open && setDeletePaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this payment record and restore the loan balance to its state before this
              payment was made. If a top-up loan was taken during this payment, it will also be removed.
              <br />
              <br />
              <strong>This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const payment = payments.find((p) => p.id === deletePaymentId)
                if (payment) handleDeletePayment(payment)
              }}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VerificationMismatchDialog
        isOpen={mismatchDialog.isOpen}
        periodKey={mismatchDialog.periodKey}
        method1Label="Previous Closing"
        method1Value={mismatchDialog.method1Value}
        method2Label="Calculated Opening"
        method2Value={mismatchDialog.method2Value}
        onSelectMethod={async (method) => {
          if (!mismatchDialog.pendingPayment) return

          // Continue deletion with selected method
          await continueDeletePaymentWithMethod(mismatchDialog.pendingPayment, method)
          setMismatchDialog((prev) => ({ ...prev, isOpen: false }))
        }}
        onCancel={() => {
          setMismatchDialog((prev) => ({ ...prev, isOpen: false }))
          setIsDeleting(false)
        }}
      />
    </>
  )
}
