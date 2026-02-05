"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils/loan-calculator"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/lib/types"

interface LoanOverviewProps {
  userId: string
  role: UserRole
}

export function LoanOverview({ userId, role }: LoanOverviewProps) {
  const [chartData, setChartData] = useState<Array<{ name: string; value: number; color: string }>>([])
  const [stats, setStats] = useState({totalLoanTaken: 0,totalPaid: 0,pendingBalance: 0,})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      let loansQuery = supabase.from("loans").select("loan_amount, user_id, id, status")

      let paymentsQuery = supabase
        .from("loan_payments")
        .select("monthly_emi, additional_principal, remaining_balance, loan_id, created_at")
        .order("created_at", { ascending: false })

      // Only filter by user_id for non-admin users
      if (role !== "admin") {
        loansQuery = loansQuery.eq("user_id", userId)
        paymentsQuery = paymentsQuery.eq("user_id", userId)
      }

      const { data: loans } = await loansQuery
      const { data: payments } = await paymentsQuery

      const totalLoanTaken = loans?.reduce((sum, loan) => sum + Number(loan.loan_amount), 0) || 0

      const totalPaid =payments?.reduce((sum, payment) => {return (sum +
          Number(payment.monthly_emi || 0) +
          Number(payment.additional_principal || 0)
        )
      }, 0) || 0


      const activeLoans = loans?.filter((loan) => loan.status === "active") || []
      let pendingBalance = 0

      // For each active loan, get the latest payment record's remaining_balance
      for (const loan of activeLoans) {
        const latestPayment = payments?.find((payment) => payment.loan_id === loan.id)
        if (latestPayment) {
          pendingBalance += Number(latestPayment.remaining_balance)
        } else {
          // If no payment record exists yet, use the loan amount as pending
          pendingBalance += Number(loan.loan_amount)
        }
      }

      setStats({ totalLoanTaken, totalPaid, pendingBalance })

      // Calculate percentages relative to total loan amount
      // Interest Paid and Pending Balance should add up to 100%
      const data = [
        { name: "Paid (EMI + Extra)", value: totalPaid, color: "#10b981" },
        { name: "Pending Balance", value: pendingBalance, color: "#f97316" },
      ].filter((item) => item.value > 0)


      console.log("Loan Overview - Total Loan:", totalLoanTaken)
      console.log("Loan Overview - Interest Paid:",  totalPaid, `(${(( totalPaid / totalLoanTaken) * 100).toFixed(2)}%)`)
      console.log("Loan Overview - Pending Balance:", pendingBalance, `(${((pendingBalance / totalLoanTaken) * 100).toFixed(2)}%)`)

      setChartData(data)
      setIsLoading(false)
    }

    fetchData()
  }, [userId, role])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>
        ) : chartData.length > 0 ? (
          <div className="space-y-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Loan Taken:</span>
                <span className="font-semibold">{formatCurrency(stats.totalLoanTaken)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid (EMI + Extra):</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(stats.totalPaid)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending Balance:</span>
                <span className="font-semibold text-orange-600">{formatCurrency(stats.pendingBalance)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-muted-foreground">No loan data available</div>
        )}
      </CardContent>
    </Card>
  )
}
