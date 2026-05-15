import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { AlertCircle, Calendar } from "lucide-react"

interface Loan {
  id: string
  user_id: string
  loan_amount: number
  created_at: string
  profiles?: { full_name: string; member_id: string }
}

interface BackfillPeriodFilterProps {
  loans: Loan[]
  onPeriodChange: (month: number, year: number, missingUsers: Loan[]) => void
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function BackfillPeriodFilter({ loans, onPeriodChange }: BackfillPeriodFilterProps) {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [validYears, setValidYears] = useState<number[]>([])
  const [validMonths, setValidMonths] = useState<number[]>([])
  const [missingDataLoans, setMissingDataLoans] = useState<Loan[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Calculate valid date range and missing data for selected period
  useEffect(() => {
    if (loans.length === 0) return

    const loanDates = loans
      .map((l) => new Date(l.created_at))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())

    if (loanDates.length === 0) return

    const earliestLoan = loanDates[0]
    const earliestYear = earliestLoan.getFullYear()
    const earliestMonth = earliestLoan.getMonth() + 1
    const currentYear = now.getFullYear()

    // Generate valid years
    const years: number[] = []
    for (let y = earliestYear; y <= currentYear; y++) {
      years.push(y)
    }
    setValidYears(years)

    // Calculate valid months for selected year
    const months: number[] = []
    if (selectedYear === earliestYear) {
      for (let m = earliestMonth; m <= 12; m++) {
        months.push(m)
      }
    } else if (selectedYear <= currentYear) {
      for (let m = 1; m <= 12; m++) {
        months.push(m)
      }
    }
    if (selectedYear === currentYear) {
      months.length = now.getMonth() + 1
    }
    setValidMonths(months)
  }, [loans])

  // Find missing data for selected period
  useEffect(() => {
    if (loans.length === 0 || validMonths.length === 0) return

    const findMissing = async () => {
      setIsLoading(true)
      try {
        const supabase = createClient()
        const periodKey = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`

        // Find which users don't have payment records for this period
        const { data: paymentRecords } = await supabase
          .from("loan_payments")
          .select("user_id")
          .eq("period_key", periodKey)

        const recordedUserIds = new Set(paymentRecords?.map((r) => r.user_id) || [])
        const missing = loans.filter(
          (l) =>
            !recordedUserIds.has(l.user_id) &&
            new Date(l.created_at) <= new Date(selectedYear, selectedMonth - 1, 1)
        )

        setMissingDataLoans(missing)
        onPeriodChange(selectedMonth, selectedYear, missing)
      } catch (error) {
        console.error("[v0] Error finding missing records:", error)
      } finally {
        setIsLoading(false)
      }
    }

    findMissing()
  }, [selectedMonth, selectedYear, loans])

  return (
    <div className="flex items-end gap-2 p-2 md:p-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Month Select */}
      <div className="flex-1 space-y-1">
        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Month</Label>
        <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
          <SelectTrigger className="h-8 md:h-9 text-xs md:text-sm">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent className="max-h-48">
            {validMonths.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {MONTHS[m - 1]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Year Select */}
      <div className="flex-1 space-y-1">
        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Year</Label>
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="h-8 md:h-9 text-xs md:text-sm">
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {validYears.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Missing Count Badge */}
      <div className="flex-1 space-y-1">
        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Missing</Label>
        <div className="h-8 md:h-9 flex items-center justify-center bg-white dark:bg-slate-950 rounded px-2 border border-slate-300 dark:border-slate-600">
          {isLoading ? (
            <span className="text-xs text-slate-500 animate-pulse">...</span>
          ) : (
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {missingDataLoans.length} users
            </span>
          )}
        </div>
      </div>

      {/* Calendar Icon */}
      <div className="flex-none">
        <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-600" />
      </div>
    </div>
  )
}
