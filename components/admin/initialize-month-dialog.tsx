"use client"

import { useState, useEffect } from "react"
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
  const [isMonthInitialized, setIsMonthInitialized] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  const router = useRouter()
  const { toast } = useToast()

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
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

  useEffect(() => {
    const checkInitialization = async () => {
      try {
        const supabase = createClient()
        const now = new Date()
        const currentPeriodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

        const { data, error } = await supabase
          .from("monthly_loan_records")
          .select("id")
          .eq("period_key", currentPeriodKey)
          .limit(1)

        if (!error && data && data.length > 0) {
          setIsMonthInitialized(true)
        }
      } catch (err) {
        console.error("[v0] Error checking initialization:", err)
      } finally {
        setIsChecking(false)
      }
    }

    checkInitialization()
  }, [])

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

      const monthYear = `${selectedYear}-${selectedMonth.padStart(2, "0")}`

      console.log("[v0] Initializing month:", monthYear, "for", members.length, "members")

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("User not authenticated")
      }

      console.log("[v0] Current user:", user.id)

      const { data, error: rpcError } = await supabase.rpc("initialize_new_month", {
        p_period_key: monthYear,
        p_created_by: user.id,
      })

      console.log("[v0] RPC response:", { data, error: rpcError })

      if (rpcError) {
        console.error("[v0] RPC error:", rpcError)
        throw new Error(rpcError.message || "Failed to initialize month")
      }

      if (data) {
        const result = typeof data === "string" ? JSON.parse(data) : data

        console.log("[v0] Parsed result:", result)

        if (result.success && result.records_created > 0) {
          const monthName = months.find((m) => m.value === selectedMonth)?.label
          toast({
            title: "Month Initialized",
            description: `Successfully created ${result.records_created} monthly records for ${monthName} ${selectedYear}`,
          })
          setOpen(false)
          router.refresh()
        } else if (result.records_created === 0) {
          console.warn("[v0] No records created")
          setError("No member records were created. Please ensure members exist with role='member'.")
        } else if (!result.success && result.error) {
          console.error("[v0] Function returned error:", result.error)
          setError(result.error)
        }
      }
    } catch (err: any) {
      console.error("[v0] Error initializing month:", err)
      setError(err.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isMonthInitialized ? "destructive" : "default"} disabled={isChecking}>
          <PlusCircle className="h-4 w-4 mr-2" />
          {isChecking ? "Checking..." : isMonthInitialized ? "Initialized" : "Initialize"}
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
