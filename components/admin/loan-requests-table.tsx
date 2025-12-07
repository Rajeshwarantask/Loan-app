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

      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .insert({
          user_id: request.user_id,
          amount: request.amount,
          interest_rate: 15,
          duration_months: 0,
          purpose: request.purpose,
          status: "active",
          approved_by: adminId,
          approved_at: new Date().toISOString(),
        })
        .select()

      if (loanError) throw loanError

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

      router.refresh()
    } catch (error) {
      console.error("[v0] Error quick rejecting:", error)
      alert("Failed to reject loan request.")
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

      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .insert({
          user_id: reviewDialog.user_id,
          amount: finalAmount,
          interest_rate: 15, // Default 15% interest
          duration_months: 0, // Set to 0 as duration is no longer required
          purpose: reviewDialog.purpose,
          status: "active",
          approved_by: adminId,
          approved_at: new Date().toISOString(),
        })
        .select()

      if (loanError) {
        console.error("[v0] Error creating loan:", loanError)
        throw loanError
      }

      console.log("[v0] Loan created successfully:", loanData)

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
