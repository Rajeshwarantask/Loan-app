"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Check } from "lucide-react"
import { InitializeMonthDialog } from "./initialize-month-dialog"
import { MonthlyRecordTable } from "./monthly-record-table"
import { MonthlyReportDialog } from "./monthly-report-dialog"

interface Profile {
  id: string
  full_name: string
  email: string
  member_id: string | null
}

interface MonthlyRecord {
  id: string
  user_id: string
  month_year: string
  month_number: number
  year_number: number
  opening_outstanding: number
  monthly_subscription: number
  interest_calculated: number
  interest_paid: number
  principal_paid: number
  new_loan_taken: number
  penalty: number
  closing_outstanding: number
  total_monthly_income: number
  previous_month_income: number
  income_difference: number
  status: string
  notes: string | null
  profiles: Profile
}

interface MonthlyCycleClientProps {
  monthlyRecords: MonthlyRecord[]
  members: Profile[]
}

export function MonthlyCycleClient({ monthlyRecords, members }: MonthlyCycleClientProps) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  // Group records by month
  const recordsByMonth = useMemo(() => {
    const grouped = new Map<string, MonthlyRecord[]>()
    monthlyRecords.forEach((record) => {
      const existing = grouped.get(record.month_year) || []
      grouped.set(record.month_year, [...existing, record])
    })
    return grouped
  }, [monthlyRecords])

  // Get unique months sorted
  const availableMonths = useMemo(() => {
    return Array.from(recordsByMonth.keys()).sort((a, b) => {
      const [aMonth, aYear] = a.split(" ")
      const [bMonth, bYear] = b.split(" ")
      const aDate = new Date(`${aMonth} 1, ${aYear}`)
      const bDate = new Date(`${bMonth} 1, ${bYear}`)
      return bDate.getTime() - aDate.getTime()
    })
  }, [recordsByMonth])

  const currentMonthRecords = selectedMonth ? recordsByMonth.get(selectedMonth) || [] : []

  const monthStats = useMemo(() => {
    if (!currentMonthRecords.length) return null

    const totalSubscription = currentMonthRecords.reduce((sum, r) => sum + (r.monthly_subscription || 0), 0)
    const totalInterest = currentMonthRecords.reduce((sum, r) => sum + (r.interest_paid || 0), 0)
    const totalPrincipal = currentMonthRecords.reduce((sum, r) => sum + (r.principal_paid || 0), 0)
    const totalNewLoans = currentMonthRecords.reduce((sum, r) => sum + (r.new_loan_taken || 0), 0)
    const totalPenalty = currentMonthRecords.reduce((sum, r) => sum + (r.penalty || 0), 0)
    const totalIncome = currentMonthRecords.reduce((sum, r) => sum + (r.total_monthly_income || 0), 0)
    const totalOutstanding = currentMonthRecords.reduce((sum, r) => sum + (r.closing_outstanding || 0), 0)

    const draftCount = currentMonthRecords.filter((r) => r.status === "draft").length
    const finalizedCount = currentMonthRecords.filter((r) => r.status === "finalized").length

    return {
      totalSubscription,
      totalInterest,
      totalPrincipal,
      totalNewLoans,
      totalPenalty,
      totalIncome,
      totalOutstanding,
      draftCount,
      finalizedCount,
    }
  }, [currentMonthRecords])

  return (
    <div className="container max-w-7xl py-6 px-2 md:px-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="pl-12 md:pl-0 px-2 md:px-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Monthly Loan Cycles</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage member-wise monthly loan records, payments, and reports
          </p>
        </div>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Cycle Management</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <InitializeMonthDialog members={members} />
          {selectedMonth && currentMonthRecords.length > 0 && (
            <MonthlyReportDialog monthYear={selectedMonth} records={currentMonthRecords} />
          )}
        </CardContent>
      </Card>

      {/* Month Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {availableMonths.map((month) => {
              const records = recordsByMonth.get(month) || []
              const allFinalized = records.every((r) => r.status === "finalized")
              return (
                <Button
                  key={month}
                  variant={selectedMonth === month ? "default" : "outline"}
                  className="justify-between"
                  onClick={() => setSelectedMonth(month)}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {month}
                  </span>
                  {allFinalized && <Check className="h-4 w-4 text-green-500" />}
                </Button>
              )
            })}
          </div>
          {availableMonths.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No monthly cycles created yet</p>
              <p className="text-sm">Click "Initialize New Month" to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Month Statistics */}
      {selectedMonth && monthStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Monthly Income</CardDescription>
              <CardTitle className="text-2xl">₹{monthStats.totalIncome.toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Subscription: ₹{monthStats.totalSubscription.toLocaleString()}</div>
                <div>Interest: ₹{monthStats.totalInterest.toLocaleString()}</div>
                <div>Principal: ₹{monthStats.totalPrincipal.toLocaleString()}</div>
                <div>Penalty: ₹{monthStats.totalPenalty.toLocaleString()}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>New Loans Issued</CardDescription>
              <CardTitle className="text-2xl">₹{monthStats.totalNewLoans.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Outstanding</CardDescription>
              <CardTitle className="text-2xl">₹{monthStats.totalOutstanding.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Status</CardDescription>
              <CardTitle className="text-2xl">
                {monthStats.finalizedCount}/{currentMonthRecords.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Badge variant="secondary">{monthStats.draftCount} Draft</Badge>
                <Badge variant="default">{monthStats.finalizedCount} Finalized</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monthly Records Table */}
      {selectedMonth && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Records - {selectedMonth}</CardTitle>
            <CardDescription>
              Member-wise loan records for the month ({currentMonthRecords.length} members)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyRecordTable records={currentMonthRecords} monthYear={selectedMonth} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
