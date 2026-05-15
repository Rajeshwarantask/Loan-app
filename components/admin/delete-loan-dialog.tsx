"use client"

import { useState } from "react"
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
import { Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface Loan {
  id: string
  user_id: string
  loan_amount: number
  status: string
  profiles: {
    full_name: string
    email: string
    member_id: string | null
  }
}

interface DeleteLoanDialogProps {
  loan: Loan
  onLoanDeleted: () => void
}

export function DeleteLoanDialog({ loan, onLoanDeleted }: DeleteLoanDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteLoan = async () => {
    setIsDeleting(true)
    const supabase = createClient()

    try {
      // Check if this is the only loan or if there are related payments
      const { data: loanPayments, error: paymentsFetchError } = await supabase
        .from("loan_payments")
        .select("id")
        .eq("loan_id", loan.id)

      if (paymentsFetchError) throw paymentsFetchError

      // If there are payments, delete them first
      if (loanPayments && loanPayments.length > 0) {
        const { error: deletePaymentsError } = await supabase
          .from("loan_payments")
          .delete()
          .eq("loan_id", loan.id)

        if (deletePaymentsError) throw deletePaymentsError
      }

      // Delete the loan itself
      const { error: deleteLoanError } = await supabase
        .from("loans")
        .delete()
        .eq("id", loan.id)

      if (deleteLoanError) throw deleteLoanError

      toast.success(`Loan for ${loan.profiles.full_name} has been deleted successfully`)
      setIsOpen(false)
      onLoanDeleted()
    } catch (error) {
      console.error("[v0] Error deleting loan:", error)
      toast.error(`Failed to delete loan: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-destructive hover:text-destructive hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4 mr-0 md:mr-1" />
        <span className="hidden md:inline text-xs">Delete</span>
      </Button>

      <AlertDialogContent className="max-w-[95vw] md:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm md:text-base">Delete Loan Assignment</AlertDialogTitle>
          <AlertDialogDescription className="text-xs md:text-sm">
            Are you sure you want to delete the loan for <strong>{loan.profiles.full_name}</strong>?
            <div className="mt-2 space-y-1 text-xs">
              <div>
                <strong>Loan Amount:</strong> ₹{Number(loan.loan_amount).toLocaleString("en-IN")}
              </div>
              <div>
                <strong>Status:</strong> {loan.status}
              </div>
              <div className="mt-3 p-2 bg-destructive/10 rounded text-destructive">
                ⚠️ This action will also delete all related payment records for this loan and cannot be undone.
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 md:gap-0">
          <AlertDialogCancel className="text-xs md:text-sm">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteLoan}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90 text-xs md:text-sm"
          >
            {isDeleting ? "Deleting..." : "Delete Loan"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
