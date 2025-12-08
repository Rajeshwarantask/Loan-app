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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface InitializeMonthDialogProps {
  members: Array<{
    id: string
    full_name: string
    member_id: string | null
  }>
}

export function InitializeMonthDialog({ members }: InitializeMonthDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [selectedYear, setSelectedYear] = useState<string>("")

  const router = useRouter()
  const { toast } = useToast()

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)
  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ]

  const handleSubmit = async () => {
    if (!selectedMonth || !selectedYear) {
      setError("Please select both month and year")
      return
    }

    if (members.length === 0) {
      setError("No members found. Please add members before initializing a month.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const monthName = months.find((m) => m.value === selectedMonth)?.label
      const monthYear = `${monthName?.substring(0, 3)} ${selectedYear}`

      // Call the database function to initialize the month
      const { data, error: rpcError } = await supabase.rpc("initialize_new_month", {
        target_month: monthYear,
        target_month_num: Number.parseInt(selectedMonth),
        target_year: Number.parseInt(selectedYear),
      })

      if (rpcError) {
        throw new Error(rpcError.message || "Failed to initialize month")
      }

      if (data) {
        const result = typeof data === "string" ? JSON.parse(data) : data

        if (result.success && result.inserted_count > 0) {
          toast({
            title: "Month Initialized",
            description: `Successfully created ${result.inserted_count} monthly records for ${monthYear}`,
          })
          setOpen(false)
          router.refresh()
        } else if (result.inserted_count === 0) {
          setError("No member records were created. Please ensure members exist with role='member'.")
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="h-4 w-4 mr-2" />
          Initialize New Month
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Initialize New Month</DialogTitle>
          <DialogDescription>
            Create monthly records for all {members.length} members. Previous month's closing balance will be carried
            forward.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="month">Month</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="month">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="year">Year</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger id="year">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200">{error}</div>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isLoading || !selectedMonth || !selectedYear}>
            {isLoading ? "Initializing..." : "Initialize Month"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
