"use client"

import { useState } from "react"
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
import { Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface DeleteMonthDialogProps {
  monthYear: string
  recordCount: number
}

export function DeleteMonthDialog({ monthYear, recordCount }: DeleteMonthDialogProps) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const formatMonthDisplay = (periodKey: string) => {
    const [year, month] = periodKey.split("-")
    const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1)
    return date.toLocaleString("default", { month: "long", year: "numeric" })
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    const supabase = createClient()

    try {
      // Delete monthly loan records for this period
      const { error: recordsError } = await supabase.from("monthly_loan_records").delete().eq("period_key", monthYear)

      if (recordsError) {
        console.error("[v0] Error deleting monthly records:", recordsError)
        toast.error(`Failed to delete monthly records: ${recordsError.message}`)
        return
      }

      // Optionally delete loan payments for this period
      const { error: paymentsError } = await supabase.from("loan_payments").delete().eq("period_key", monthYear)

      if (paymentsError) {
        console.error("[v0] Error deleting loan payments:", paymentsError)
        // Don't fail if payment deletion fails, just warn
        toast.warning("Monthly records deleted but some payments may remain")
      }

      toast.success(`Successfully deleted all data for ${formatMonthDisplay(monthYear)}`)
      setOpen(false)
      router.refresh()
    } catch (error) {
      console.error("[v0] Delete month error:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Month
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Monthly Cycle Data</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete all data for {formatMonthDisplay(monthYear)}?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-destructive/10 p-4 text-sm">
            <p className="font-medium text-destructive mb-2">This action cannot be undone!</p>
            <p className="text-muted-foreground">This will permanently delete:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>{recordCount} monthly loan records</li>
              <li>All payment records for this period</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Month Data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
