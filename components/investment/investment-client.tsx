"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { toast } from "sonner"
import { Trash2, Plus } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"

interface Investment {
  id: string
  user_id: string
  member_id: string | null
  investment_type: string
  amount: number
  current_value: number
  notes?: string
  period_month: number
  period_year: number
  period_key: string
  created_at: string
}

const CHART_COLORS = ["#fb923c", "#7dd3fc", "#34d399", "#fbbf24", "#a78bfa", "#f472b6", "#94a3b8"]

interface InvestmentClientProps {
  userId: string
  memberId: string | null
}

const toTitleCase = (str: string) => {
  return str
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function InvestmentClient({ userId, memberId }: InvestmentClientProps) {
  const [investments, setInvestments] = useState<Investment[]>([])
  const [amount, setAmount] = useState("")
  const [investmentType, setInvestmentType] = useState("")
  const [currentValue, setCurrentValue] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [investmentMonth, setInvestmentMonth] = useState(() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
})
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })
  const [availableMonths, setAvailableMonths] = useState<string[]>([])

  const supabase = createBrowserClient()

  // Fetch available months
  useEffect(() => {
    fetchAvailableMonths()
  }, [])

  // Fetch investments for selected month
  useEffect(() => {
    fetchInvestments()
  }, [selectedMonth])

  const fetchAvailableMonths = async () => {
    const { data, error } = await supabase
      .from("investments")
      .select("period_key")
      .eq("user_id", userId)
      .order("period_key", { ascending: false })

    if (!error && data) {
      const uniqueMonths = Array.from(new Set(data.map((inv) => inv.period_key)))
      setAvailableMonths(uniqueMonths)
    }
  }

  const fetchInvestments = async () => {
    const { data, error } = await supabase
      .from("investments")
      .select("*")
      .eq("user_id", userId)
      .eq("period_key", selectedMonth)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching investments:", error)
      toast.error("Failed to load investments")
    } else {
      setInvestments(data || [])
    }
  }

  const handleAddInvestment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!amount || !investmentType) {
      toast.error("Please fill in all fields")
      return
    }

    const amountNum = Number.parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    setLoading(true)

    const periodKey = investmentMonth
    const [year, month] = investmentMonth.split("-")
    
    const periodYear = Number(year)
    const periodMonth = Number(month)

    const { error } = await supabase.from("investments").insert({
      user_id: userId,
      member_id: memberId,
      investment_type: investmentType,
      amount: amountNum,
      current_value: Number(currentValue) || amountNum,
      notes,
      period_month: periodMonth,
      period_year: periodYear,
      period_key: periodKey,
    })

    if (error) {
      console.error("Error adding investment:", error)
      toast.error("Failed to add investment")
    } else {
      toast.success("Investment added successfully")
      setAmount("")
      setInvestmentType("")
      setCurrentValue("")
      setNotes("")

      // Refresh data
      await fetchAvailableMonths()

      // If we added to current month and it's selected, refresh
      if (selectedMonth === periodKey) {
        await fetchInvestments()
      } else {
        // Switch to current month to show new investment
        setSelectedMonth(periodKey)
      }
    }

    setLoading(false)
  }

  const handleDeleteInvestment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this investment?")) {
      return
    }

    const { error } = await supabase.from("investments").delete().eq("id", id)

    if (error) {
      console.error("Error deleting investment:", error)
      toast.error("Failed to delete investment")
    } else {
      toast.success("Investment deleted successfully")
      fetchInvestments()
      fetchAvailableMonths()
    }
  }

  // Calculate totals and percentages
  const totalAmount = investments.reduce((sum, inv) => sum + Number(inv.amount), 0)
  const totalCurrentValue = investments.reduce(
    (sum, inv) => sum + Number(inv.current_value || 0),
    0
  )
  
  const totalProfit = totalCurrentValue - totalAmount
  
  const profitPercent =
    totalAmount > 0
      ? ((totalProfit / totalAmount) * 100).toFixed(2)
      : "0"
  
  const groupedInvestments = investments.reduce((acc, inv) => {
    const type = inv.investment_type
  
        if (!acc[type]) {
          acc[type] = 0
        }
      
        acc[type] += Number(inv.current_value || inv.amount)
        return acc
      }, {} as Record<string, number>)
      
     const chartData = Object.entries(groupedInvestments).map(([name, value]) => ({
        name,
        value,
        percentage:
          totalCurrentValue > 0
            ? ((value / totalCurrentValue) * 100).toFixed(1)
            : "0",
      }))

  return (
    <div className="space-y-6">
      {/* Add Investment Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Investment</CardTitle>
          <CardDescription>Enter investment details for the current month</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddInvestment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Investment Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1000"
                  step="100"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Investment Type</Label>
                    <Input
                      id="type"
                      type="text"
                      placeholder="e.g. Gold, Mutual Funds, Real Estate"
                      value={investmentType}
                      onChange={(e) => setInvestmentType(toTitleCase(e.target.value))}
                      required
                    />              
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentValue">Current Value (₹)</Label>
                <Input
                  id="currentValue"
                  type="number"
                  placeholder="Current market value"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  min="0"
                />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  placeholder="Optional remarks"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="investmentMonth">Investment Month</Label>
              
                <Input
                  id="investmentMonth"
                  type="month"
                  value={investmentMonth}
                  onChange={(e) => setInvestmentMonth(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full md:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              {loading ? "Adding..." : "Add Investment"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Month Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="month-filter">Select Month-Year</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger id="month-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.length > 0 ? (
                    availableMonths.map((month) => {
                      const [year, monthNum] = month.split("-")
                      const date = new Date(Number.parseInt(year), Number.parseInt(monthNum) - 1)
                      const monthName = date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                      return (
                        <SelectItem key={month} value={month}>
                          {monthName}
                        </SelectItem>
                      )
                    })
                  ) : (
                    <SelectItem value={selectedMonth}>
                      {new Date(
                        Number.parseInt(selectedMonth.split("-")[0]),
                        Number.parseInt(selectedMonth.split("-")[1]) - 1,
                      ).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Invested</p>
              <p className="text-2xl font-bold">
                ₹{totalAmount.toLocaleString("en-IN")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Current Value</p>
              <p className="text-2xl font-bold">
                ₹{totalCurrentValue.toLocaleString("en-IN")}
              </p>
            </CardContent>
          </Card>
        
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Profit / Loss</p>
              <p
                className={`text-2xl font-bold ${
                  totalProfit >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                ₹{totalProfit.toLocaleString("en-IN")}
              </p>
            </CardContent>
          </Card>
        
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Return %</p>
              <p
                className={`text-2xl font-bold ${
                  Number(profitPercent) >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {profitPercent}%
              </p>
            </CardContent>
          </Card>
        </div>
      
      {/* Investment History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Investment History</CardTitle>
          <CardDescription>
            Total Invested: ₹{totalAmount.toLocaleString("en-IN")} for{" "}
            {new Date(
              Number.parseInt(selectedMonth.split("-")[0]),
              Number.parseInt(selectedMonth.split("-")[1]) - 1,
            ).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {investments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No investments found for this month</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Investment Type</TableHead>
                    <TableHead className="text-right">Invested (₹)</TableHead>
                    <TableHead className="text-right">Current Value (₹)</TableHead>
                    <TableHead className="text-right">Profit/Loss (₹)</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.map((investment) => (
                    <TableRow key={investment.id}>
                        <TableCell>
                          {new Date(investment.created_at).toLocaleDateString("en-IN", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                      
                        <TableCell>{investment.investment_type}</TableCell>
                      
                        <TableCell className="text-right">
                          ₹{Number(investment.amount).toLocaleString("en-IN")}
                        </TableCell>
                      
                        <TableCell className="text-right">
                          ₹{Number(investment.current_value || 0).toLocaleString("en-IN")}
                        </TableCell>
                      
                        <TableCell
                          className={`text-right font-medium ${
                            Number(investment.current_value || 0) - Number(investment.amount) >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          ₹{(
                            Number(investment.current_value || 0) -
                            Number(investment.amount)
                          ).toLocaleString("en-IN")}
                        </TableCell>
                      
                        <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteInvestment(investment.id)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Investment Distribution Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Investment Distribution</CardTitle>
            <CardDescription>Percentage breakdown by investment type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Amount"]}
                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {chartData.map((item, index) => (
                <div key={item.name} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <p className="text-2xl font-bold">₹{item.value.toLocaleString("en-IN")}</p>
                  <p className="text-sm text-muted-foreground">{item.percentage}% of total</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
