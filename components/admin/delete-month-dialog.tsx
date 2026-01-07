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
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface DeleteMonthDialogProps {
  periodKey: string
  isCurrentMonth: boolean
}

export function DeleteMonthDialog({ periodKey, isCurrentMonth }: DeleteMonthDialogProps) {
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

    try {
      const response = await fetch("/api/admin/delete-month", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          periodKey,
          isCurrentMonth,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete month data")
      }

      toast.success(result.message)
      setOpen(false)
      router.refresh()
    } catch (error) {
      console.error("[v0] Delete month error:", error)
      toast.error(error instanceof Error ? error.message : "An unexpected error occurred")
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
            Are you sure you want to delete all data for {formatMonthDisplay(periodKey)}?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-destructive/10 p-4 text-sm">
            <p className="font-medium text-destructive mb-2">This action cannot be undone!</p>
            <p className="text-muted-foreground">
              This will permanently delete all monthly records for {formatMonthDisplay(periodKey)} from{" "}
              {isCurrentMonth ? "current month data" : "history"}.
            </p>
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
