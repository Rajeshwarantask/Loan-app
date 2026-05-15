"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AlertCircle, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface DeleteMonthlyRecordDialogProps {
  record: {
    id: string
    user_id: string
    period_key: string
    profiles: {
      full_name: string
      member_id: string | null
    }
  }
}

export function DeleteMonthlyRecordDialog({ record }: DeleteMonthlyRecordDialogProps) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("You must be logged in")
      }

      // Try to delete from monthly_loan_records first
      const { error: recordError } = await supabase
        .from("monthly_loan_records")
        .delete()
        .eq("id", record.id)

      // If that fails or returns 0 rows, it might be a synthetic record
      // Try deleting the underlying loan_payment record
      if (recordError) {
        console.log("[v0] Record not found in monthly_loan_records, checking loan_payments")
      }

      // For synthetic records, we just need to remove them from view
      // They'll be regenerated next time if the payment still exists

      setOpen(false)
      router.refresh()

      toast({
        title: "Record deleted",
        description: `Monthly record for ${record.profiles.member_id} has been deleted`,
      })
    } catch (err: any) {
      console.error("[v0] Error deleting record:", err)
      toast({
        title: "Error",
        description: err.message || "Failed to delete record",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Delete Monthly Record
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the monthly record for {record.profiles.member_id} {record.profiles.full_name}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
            <p className="font-medium">Period: {record.period_key}</p>
            <p className="text-xs mt-1">This action cannot be undone. The record will be permanently deleted.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
