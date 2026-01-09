"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface CollectionStatsChartsProps {
  role: string
}

export function CollectionStatsCharts({ role }: CollectionStatsChartsProps) {
  const [emiData, setEmiData] = useState<{ name: string; value: number; fill: string }[]>([])
  const [additionalLoanData, setAdditionalLoanData] = useState<{ name: string; value: number; fill: string }[]>([])
  const [additionalPrincipalData, setAdditionalPrincipalData] = useState<
    { name: string; value: number; fill: string }[]
  >([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const currentDate = new Date()
      const currentPeriodKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`

      // Get active loans count
      const { data: activeLoans } = await supabase.from("loans").select("id, user_id").eq("status", "active")

      const activeLoanCount = activeLoans?.length || 0
      const expectedEMI = activeLoanCount * 5000

      // Get current month EMI collection
      const { data: payments } = await supabase
        .from("loan_payments")
        .select("monthly_emi, user_id, additional_principal")
        .eq("period_key", currentPeriodKey)

      const collectedEMI = payments?.reduce((sum, p) => sum + Number(p.monthly_emi || 0), 0) || 0
      const emiPercentage = expectedEMI > 0 ? Math.round((collectedEMI / expectedEMI) * 100) : 0

      setEmiData([
        { name: "Collected", value: emiPercentage, fill: "#0069c7" },
        { name: "Pending", value: 100 - emiPercentage, fill: "#fb923c" },
      ])

      // Get additional loan stats
      const { data: additionalLoans } = await supabase
        .from("additional_loan")
        .select("user_id")
        .eq("period_key", currentPeriodKey)

      const uniqueUsersWithAdditionalLoan = new Set(additionalLoans?.map((l) => l.user_id)).size
      const additionalLoanPercentage =
        activeLoanCount > 0 ? Math.round((uniqueUsersWithAdditionalLoan / activeLoanCount) * 100) : 0

      setAdditionalLoanData([
        { name: "New Loan", value: additionalLoanPercentage, fill: "#0069c7" },
        { name: "Regular", value: 100 - additionalLoanPercentage, fill: "#fb923c" },
      ])

      // Get additional principal stats - count users who paid extra principal
      const usersWithAdditionalPrincipal = new Set(
        payments?.filter((p) => Number(p.additional_principal || 0) > 0).map((p) => p.user_id),
      ).size
      const additionalPrincipalPercentage =
        activeLoanCount > 0 ? Math.round((usersWithAdditionalPrincipal / activeLoanCount) * 100) : 0

      setAdditionalPrincipalData([
        { name: "Paid Extra", value: additionalPrincipalPercentage, fill: "#0069c7" },
        { name: "Regular", value: 100 - additionalPrincipalPercentage, fill: "#fb923c" },
      ])

      setIsLoading(false)
    }

    fetchData()
  }, [role])

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">EMI Collection</CardTitle>
          <p className="text-sm text-muted-foreground">Current month collection rate</p>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={emiData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {emiData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{emiData[0]?.value || 0}%</p>
            <p className="text-sm text-muted-foreground">of members paid EMI</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New Loans</CardTitle>
          <p className="text-sm text-muted-foreground">Members who took additional loans</p>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={additionalLoanData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {additionalLoanData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{additionalLoanData[0]?.value || 0}%</p>
            <p className="text-sm text-muted-foreground">of members took New Loans</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Additional Principal</CardTitle>
          <p className="text-sm text-muted-foreground">Members reducing principal amount</p>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={additionalPrincipalData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {additionalPrincipalData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{additionalPrincipalData[0]?.value || 0}%</p>
            <p className="text-sm text-muted-foreground">of members paying additional principal</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
