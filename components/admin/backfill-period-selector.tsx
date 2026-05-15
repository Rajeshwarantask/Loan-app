import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

interface BackfillLoansWithMissingData extends Loan {
  hasMissingData: boolean
}

interface BackfillPeriodSelectorProps {
  loans: Loan[]
  onPeriodChange: (month: number, year: number, missingUsers: Loan[]) => void
}

export function BackfillPeriodSelector({ loans, onPeriodChange }: BackfillPeriodSelectorProps) {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [validYears, setValidYears] = useState<number[]>([])
  const [validMonths, setValidMonths] = useState<number[]>([])
  const [missingDataLoans, setMissingDataLoans] = useState<Loan[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Calculate valid date range based on earliest loan creation
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
    const now = new Date()
    const currentYear = now.getFullYear()

    // Generate valid years from earliest loan year to current year
    const years: number[] = []
    for (let y = earliestYear; y <= currentYear; y++) {
      years.push(y)
    }
    setValidYears(years)

    // Initialize with current month/year if valid, otherwise use earliest
    if (selectedYear < earliestYear || (selectedYear === earliestYear && selectedMonth < earliestMonth)) {
      setSelectedYear(earliestYear)
      setSelectedMonth(earliestMonth)
    }
  }, [loans])

  // Calculate valid months based on selected year
  useEffect(() => {
    if (loans.length === 0 || validYears.length === 0) return

    const earliestLoanDate = loans
      .map((l) => new Date(l.created_at))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())[0]

    const earliestYear = earliestLoanDate.getFullYear()
    const earliestMonth = earliestLoanDate.getMonth() + 1
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    const months: number[] = []

    if (selectedYear === earliestYear) {
      // If selected year is earliest, start from earliest month
      const startMonth = earliestMonth
      const endMonth = selectedYear === currentYear ? currentMonth : 12
      for (let m = startMonth; m <= endMonth; m++) {
        months.push(m)
      }
    } else if (selectedYear < currentYear) {
      // Full year for years between earliest and current
      for (let m = 1; m <= 12; m++) {
        months.push(m)
      }
    } else if (selectedYear === currentYear) {
      // Up to current month for current year
      for (let m = 1; m <= currentMonth; m++) {
        months.push(m)
      }
    }

    setValidMonths(months)

    // Adjust selected month if it's out of range
    if (!months.includes(selectedMonth)) {
      setSelectedMonth(months[0])
    }
  }, [selectedYear, loans, validYears])

  // Fetch loans missing data for selected period
  useEffect(() => {
    const checkMissingData = async () => {
      setIsLoading(true)
      try {
        const supabase = createClient()
        const periodKey = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`

        // Get all payment records for this period
        const { data: payments, error } = await supabase
          .from("loan_payments")
          .select("user_id")
          .eq("period_key", periodKey)

        if (error) {
          console.error("[v0] Error fetching payments:", error)
          setMissingDataLoans([])
          return
        }

        const paidUserIds = new Set(payments?.map((p) => p.user_id) || [])

        // Find loans created on or before this period
        const missing = loans.filter((loan) => {
          const loanDate = new Date(loan.created_at)
          const selectedDate = new Date(selectedYear, selectedMonth - 1, 1)

          // Loan should exist by selected period
          if (loanDate > selectedDate) return false

          // Check if user has payment for this period
          return !paidUserIds.has(loan.user_id)
        })

        setMissingDataLoans(missing)
        onPeriodChange(selectedMonth, selectedYear, missing)
      } catch (err) {
        console.error("[v0] Error checking missing data:", err)
        setMissingDataLoans([])
      } finally {
        setIsLoading(false)
      }
    }

    checkMissingData()
  }, [selectedMonth, selectedYear, loans, onPeriodChange])

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Backfill Missing Entries
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Month Selector */}
          <div className="space-y-2">
            <Label htmlFor="backfill-month">Month</Label>
            <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(Number(val))}>
              <SelectTrigger id="backfill-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {validMonths.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {monthNames[m - 1]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Year Selector */}
          <div className="space-y-2">
            <Label htmlFor="backfill-year">Year</Label>
            <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
              <SelectTrigger id="backfill-year">
                <SelectValue />
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

          {/* Summary */}
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="h-10 px-3 py-2 rounded-md border border-input bg-background flex items-center text-sm">
              {isLoading ? (
                <span className="text-muted-foreground">Checking...</span>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="font-medium">{missingDataLoans.length} missing</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Missing Users List */}
        {!isLoading && missingDataLoans.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-900 mb-2">Missing entries for {monthNames[selectedMonth - 1]} {selectedYear}:</p>
            <div className="text-xs text-amber-800 max-h-32 overflow-y-auto space-y-1">
              {missingDataLoans.map((loan) => (
                <div key={loan.user_id} className="flex justify-between">
                  <span>{loan.profiles?.member_id}</span>
                  <span>{loan.profiles?.full_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && missingDataLoans.length === 0 && loans.length > 0 && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            ✓ All entries for {monthNames[selectedMonth - 1]} {selectedYear} are complete
          </div>
        )}
      </CardContent>
    </Card>
  )
}
