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
  member_id: string | null
  period_key: string // Format: YYYY-MM
  period_month: number
  period_year: number
  status: string
  monthly_subscription: number
  total_loan_taken: number
  additional_principal: number
  new_loan_taken: number
  total_loan_outstanding: number
  monthly_interest_income: number
  monthly_installment_income: number
  penalty: number
  previous_month_total_income: number
  total_income_current_month: number
  difference: number
  previous_month_total_loan_outstanding: number
  available_loan_amount: number
  profiles: Profile
}

interface MonthlyCycleClientProps {
  monthlyRecords: MonthlyRecord[]
  members: Profile[]
}

export function MonthlyCycleClient({ monthlyRecords, members }: MonthlyCycleClientProps) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  const recordsByMonth = useMemo(() => {
    const grouped = new Map<string, MonthlyRecord[]>()
    monthlyRecords.forEach((record) => {
      const existing = grouped.get(record.period_key) || []
      grouped.set(record.period_key, [...existing, record])
    })
    return grouped
  }, [monthlyRecords])

  const availableMonths = useMemo(() => {
    return Array.from(recordsByMonth.keys()).sort((a, b) => {
      return b.localeCompare(a) // Descending order: 2025-12, 2025-11, etc.
    })
  }, [recordsByMonth])

  const currentMonthRecords = selectedMonth ? recordsByMonth.get(selectedMonth) || [] : []

  const monthStats = useMemo(() => {
    if (!currentMonthRecords.length) return null

    const totalSubscription = currentMonthRecords.reduce((sum, r) => sum + r.monthly_subscription, 0)
    const totalInterest = currentMonthRecords.reduce((sum, r) => sum + r.monthly_interest_income, 0)
    const totalPrincipal = currentMonthRecords.reduce((sum, r) => sum + r.additional_principal, 0)
    const totalNewLoans = currentMonthRecords.reduce((sum, r) => sum + r.new_loan_taken, 0)
    const totalPenalty = currentMonthRecords.reduce((sum, r) => sum + r.penalty, 0)
    const totalIncome = currentMonthRecords.reduce((sum, r) => sum + r.total_income_current_month, 0)
    const totalOutstanding = currentMonthRecords.reduce((sum, r) => sum + r.total_loan_outstanding, 0)

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

  const formatMonthDisplay = (periodKey: string) => {
    const [year, month] = periodKey.split("-")
    const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1)
    return date.toLocaleString("default", { month: "long", year: "numeric" })
  }

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
            <>
              <MonthlyReportDialog monthYear={selectedMonth} records={currentMonthRecords} />
            </>
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
            {availableMonths.map((periodKey) => {
              const records = recordsByMonth.get(periodKey) || []
              const allFinalized = records.every((r) => r.status === "finalized")
              const displayMonth = formatMonthDisplay(periodKey)
              return (
                <Button
                  key={periodKey}
                  variant={selectedMonth === periodKey ? "default" : "outline"}
                  className="justify-between"
                  onClick={() => setSelectedMonth(periodKey)}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {displayMonth}
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
            <CardTitle>Monthly Records - {formatMonthDisplay(selectedMonth)}</CardTitle>
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
