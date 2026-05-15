"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils/loan-calculator"
import { format } from "date-fns"
import { Check, X, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface LoanRequest {
  id: string
  user_id: string
  amount: number
  purpose: string
  status: string
  created_at: string
  admin_remark?: string
  approved_amount?: number
  profiles: {
    full_name: string
    email: string
  }
}

interface LoanRequestsTableProps {
  requests: LoanRequest[]
  adminId: string
}

export function LoanRequestsTable({ requests, adminId }: LoanRequestsTableProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [reviewDialog, setReviewDialog] = useState<LoanRequest | null>(null)
  const [approvedAmount, setApprovedAmount] = useState<string>("")
  const [remark, setRemark] = useState<string>("")
  const router = useRouter()

  const openReviewDialog = (request: LoanRequest) => {
    setReviewDialog(request)
    setApprovedAmount(request.amount.toString())
    setRemark(request.admin_remark || "")
  }

  const handleQuickApprove = async (request: LoanRequest) => {
    setLoading(request.id)
    const supabase = createClient()

    try {
      console.log("[v0] Quick approving loan request:", request.id)

      const { data: existingLoans, error: checkError } = await supabase
        .from("loans")
        .select("id, loan_amount")
        .eq("user_id", request.user_id)
        .eq("status", "active")

      if (checkError) throw checkError

      const hasActiveLoan = existingLoans && existingLoans.length > 0

      if (hasActiveLoan) {
        console.log("[v0] User has active loan, saving as additional loan")

        const activeLoan = existingLoans[0]
        const newLoanAmount = (activeLoan.loan_amount || 0) + request.amount

        const { error: additionalLoanError } = await supabase.from("additional_loan").insert({
          user_id: request.user_id,
          member_id: request.profiles?.member_id,
          loan_id: activeLoan.id,
          full_name: request.profiles?.full_name || "Unknown",
          additional_loan_amount: request.amount,
          period_key: format(new Date(), "yyyy-MM"),
          period_month: new Date().getMonth() + 1,
          period_year: new Date().getFullYear(),
        })

        if (additionalLoanError) throw additionalLoanError

        const { error: updateLoanError } = await supabase
          .from("loans")
          .update({
          loan_amount: newLoanAmount,
          })
          .eq("id", activeLoan.id)

          if (updateLoanError) throw updateLoanError
        } else {
          console.log("[v0] No active loan found, creating new loan")

          const today = new Date()
          const periodKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

          const { error: loanError } = await supabase.from("loans").insert({
            user_id: request.user_id,
            member_id: request.profiles?.member_id,
            full_name: request.profiles?.full_name || "Unknown",
            loan_amount: request.amount,
            interest_rate: 15,
            status: "active",
            approved_by: adminId,
            period_year: today.getFullYear(),
            period_month: today.getMonth() + 1,
            period_key: periodKey,
        })

        if (loanError) throw loanError
      }

      const { error: requestError } = await supabase
        .from("loan_requests")
        .update({
          status: "approved",
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          approved_amount: request.amount,
        })
        .eq("id", request.id)

      if (requestError) throw requestError

      // Send loan approval notification via API
      const monthlyEMI = (request.amount * 0.15) / 12
      fetch("/api/notifications/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "loan_approval",
          userId: request.user_id,
          title: "Loan Request Approved",
          body: `Your loan request of ${request.amount} has been approved. Monthly EMI: ${monthlyEMI.toFixed(2)}`,
          data: { type: "loan_approval", amount: request.amount },
        }),
      }).catch((err) => console.error("[v0] Failed to send approval notification:", err))

      router.refresh()
    } catch (error) {
      console.error("[v0] Error quick approving:", error)
      alert("Failed to approve loan request.")
    } finally {
      setLoading(null)
    }
  }

  const handleQuickReject = async (request: LoanRequest) => {
    setLoading(request.id)
    const supabase = createClient()

    try {
      await supabase
        .from("loan_requests")
        .update({
          status: "rejected",
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", request.id)

      // Send loan rejection notification via API
      fetch("/api/notifications/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "loan_rejection",
          userId: request.user_id,
          title: "Loan Request Rejected",
          body: "Your loan request has been reviewed and rejected.",
          data: { type: "loan_rejection" },
        }),
      }).catch((err) => console.error("[v0] Failed to send rejection notification:", err))

      router.refresh()
    } catch (error) {
      console.error("[v0] Error quick rejecting:", error)
    } finally {
      setLoading(null)
    }
  }

  const handleApprove = async () => {
    if (!reviewDialog) return

    setLoading(reviewDialog.id)
    const supabase = createClient()

    try {
      console.log("[v0] Approving loan request:", reviewDialog.id, "for user:", reviewDialog.user_id)

      const finalAmount = Number.parseFloat(approvedAmount) || reviewDialog.amount

      const { data: existingLoans, error: checkError } = await supabase
        .from("loans")
        .select("id, loan_amount")
        .eq("user_id", reviewDialog.user_id)
        .eq("status", "active")

      if (checkError) throw checkError

      const hasActiveLoan = existingLoans && existingLoans.length > 0

      if (hasActiveLoan) {
        console.log("[v0] User has active loan, saving as additional loan")

        const activeLoan = existingLoans[0]
          const newLoanAmount = (activeLoan.loan_amount || 0) + finalAmount

        const { error: additionalLoanError } = await supabase.from("additional_loan").insert({
          user_id: reviewDialog.user_id,
          member_id: reviewDialog.profiles?.member_id,
          loan_id: activeLoan.id,
          full_name: reviewDialog.profiles?.full_name || "Unknown",
          additional_loan_amount: finalAmount,
          period_key: format(new Date(), "yyyy-MM"),
          period_month: new Date().getMonth() + 1,
          period_year: new Date().getFullYear(),
        })

        if (additionalLoanError) {
          console.error("[v0] Error creating additional loan:", additionalLoanError)
          throw additionalLoanError
        }

        const { error: updateLoanError } = await supabase
          .from("loans")
          .update({
            loan_amount: newLoanAmount,
          })
          .eq("id", activeLoan.id)

        if (updateLoanError) {
          console.error("[v0] Error updating loan:", updateLoanError)
          throw updateLoanError
        }
      } else {
        console.log("[v0] No active loan found, creating new loan")

        const today = new Date()
        const periodKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

        const { error: loanError } = await supabase.from("loans").insert({
          user_id: reviewDialog.user_id,
          member_id: reviewDialog.profiles?.member_id,
          full_name: reviewDialog.profiles?.full_name || "Unknown",
          loan_amount: finalAmount,
          interest_rate: 15,
          status: "active",
          approved_by: adminId,
          period_year: today.getFullYear(),
          period_month: today.getMonth() + 1,
          period_key: periodKey,
        })

        if (loanError) {
          console.error("[v0] Error creating loan:", loanError)
          throw loanError
        }
      }

      console.log("[v0] Loan approved successfully")

      const { error: requestError } = await supabase
        .from("loan_requests")
        .update({
          status: "approved",
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          approved_amount: finalAmount,
          admin_remark: remark,
        })
        .eq("id", reviewDialog.id)

      if (requestError) {
        console.error("[v0] Error updating request status:", requestError)
        throw requestError
      }

      console.log("[v0] Loan request approved successfully")

      // Send loan approval notification via API
      const monthlyEMI = (finalAmount * 0.15) / 12
      fetch("/api/notifications/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "loan_approval",
          userId: reviewDialog.user_id,
          title: "Loan Request Approved",
          body: `Your loan request of ${finalAmount} has been approved. Monthly EMI: ${monthlyEMI.toFixed(2)}`,
          data: { type: "loan_approval", amount: finalAmount },
        }),
      }).catch((err) => console.error("[v0] Failed to send approval notification:", err))

      setReviewDialog(null)
      router.refresh()
    } catch (error) {
      console.error("[v0] Error approving request:", error)
      alert("Failed to approve loan request. Please try again.")
    } finally {
      setLoading(null)
    }
  }

  const handleReject = async () => {
    if (!reviewDialog) return

    setLoading(reviewDialog.id)
    const supabase = createClient()

    try {
      await supabase
        .from("loan_requests")
        .update({
          status: "rejected",
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          admin_remark: remark,
        })
        .eq("id", reviewDialog.id)

      // Send loan rejection notification via API
      fetch("/api/notifications/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "loan_rejection",
          userId: reviewDialog.user_id,
          title: "Loan Request Rejected",
          body: `Your loan request has been reviewed and rejected. ${remark ? `Reason: ${remark}` : ""}`,
          data: { type: "loan_rejection", reason: remark },
        }),
      }).catch((err) => console.error("[v0] Failed to send rejection notification:", err))

      setReviewDialog(null)
      router.refresh()
    } catch (error) {
      console.error("[v0] Error rejecting request:", error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <div className="font-medium">{request.profiles.full_name}</div>
                </TableCell>
                <TableCell className="font-semibold">
                  {formatCurrency(request.amount)}
                  {request.approved_amount && request.approved_amount !== request.amount && (
                    <div className="text-xs text-green-600">Approved: {formatCurrency(request.approved_amount)}</div>
                  )}
                </TableCell>
                <TableCell className="max-w-xs truncate">{request.purpose}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      request.status === "approved"
                        ? "default"
                        : request.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {request.status}
                  </Badge>
                </TableCell>
                <TableCell>{format(new Date(request.created_at), "MMM dd, yyyy")}</TableCell>
                <TableCell className="text-right">
                  {request.status === "pending" && (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleQuickApprove(request)}
                        disabled={loading === request.id}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleQuickReject(request)}
                        disabled={loading === request.id}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openReviewDialog(request)}
                        disabled={loading === request.id}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Loan Request</DialogTitle>
            <DialogDescription>
              Review and approve or reject this loan request from {reviewDialog?.profiles.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Requested Amount</Label>
              <p className="text-2xl font-semibold">{reviewDialog && formatCurrency(reviewDialog.amount)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approved-amount">Approved Amount (₹)</Label>
              <Input
                id="approved-amount"
                type="number"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                placeholder="Enter approved amount"
                min="100"
                step="100"
              />
              <p className="text-xs text-muted-foreground">You can modify the amount if approving partially</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose</Label>
              <p className="text-sm">{reviewDialog?.purpose}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="remark">Admin Remark (Optional)</Label>
              <Textarea
                id="remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Add a note for the user (e.g., 'Approved for partial amount', 'Please contact admin', etc.)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={handleReject} disabled={!!loading}>
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button onClick={handleApprove} disabled={!!loading}>
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
