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
  const [stats, setStats] = useState({ totalLoanTaken: 0, totalInterestPaid: 0, pendingBalance: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const { data: loans } = await supabase.from("loans").select("amount, status").eq("user_id", userId)

      const { data: payments } = await supabase
        .from("loan_payments")
        .select("interest_paid, principal_paid, remaining_balance, status")
        .eq("user_id", userId)

      const totalLoanTaken = loans?.reduce((sum, loan) => sum + Number(loan.amount), 0) || 0

      const totalInterestPaid = payments?.reduce((sum, payment) => sum + Number(payment.interest_paid), 0) || 0

      const pendingBalance =
        loans?.filter((loan) => loan.status === "active").reduce((sum, loan) => sum + Number(loan.amount), 0) || 0

      setStats({ totalLoanTaken, totalInterestPaid, pendingBalance })

      const data = [
        { name: "Total Loan", value: totalLoanTaken, color: "#8b5cf6" }, // Purple
        { name: "Interest Paid", value: totalInterestPaid, color: "#10b981" }, // Green
        { name: "Pending", value: pendingBalance, color: "#f97316" }, // Orange
      ].filter((item) => item.value > 0)

      setChartData(data)
      setIsLoading(false)
    }

    fetchData()
  }, [userId])

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
                <span className="text-muted-foreground">Interest Paid:</span>
                <span className="font-semibold text-green-600">{formatCurrency(stats.totalInterestPaid)}</span>
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
