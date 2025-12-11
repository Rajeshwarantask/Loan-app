"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface BulkSettingsClientProps {
  periods: string[]
}

export function BulkSettingsClient({ periods }: BulkSettingsClientProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [monthlyContribution, setMonthlyContribution] = useState("2100")
  const [monthlyEmi, setMonthlyEmi] = useState("5000")
  const [availableLoan, setAvailableLoan] = useState("400000")
  const [filterPeriod, setFilterPeriod] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [updatedCount, setUpdatedCount] = useState<number | null>(null)

  const handleApplyToAll = async () => {
    setLoading(true)
    setUpdatedCount(null)

    try {
      console.log("[v0] Sending bulk update request:", {
        monthlySubscription: Number.parseFloat(monthlyContribution),
        availableLoanAmount: Number.parseFloat(availableLoan),
        periodKey: filterPeriod === "all" ? null : filterPeriod,
        status: filterStatus === "all" ? null : filterStatus,
      })

      const response = await fetch("/api/admin/bulk-update-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          monthlySubscription: Number.parseFloat(monthlyContribution),
          availableLoanAmount: Number.parseFloat(availableLoan),
          periodKey: filterPeriod === "all" ? null : filterPeriod,
          status: filterStatus === "all" ? null : filterStatus,
        }),
      })

      const data = await response.json()

      console.log("[v0] Bulk update response:", data)

      if (!response.ok) {
        throw new Error(data.error || "Failed to update settings")
      }

      setUpdatedCount(data.count)
      toast({
        title: "Success",
        description: `Updated ${data.count} record(s) successfully.`,
      })
    } catch (error) {
      console.error("[v0] Bulk update error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update settings",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Settings Update</CardTitle>
          <CardDescription>
            Update common values for all monthly loan records. These values will be applied to all matching records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Fields */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="monthlyContribution">Monthly Contribution (₹)</Label>
              <Input
                id="monthlyContribution"
                type="number"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                placeholder="2100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyEmi">Monthly EMI (₹)</Label>
              <Input
                id="monthlyEmi"
                type="number"
                value={monthlyEmi}
                onChange={(e) => setMonthlyEmi(e.target.value)}
                placeholder="5000"
                disabled
                className="opacity-60"
              />
              <p className="text-xs text-muted-foreground">EMI is calculated automatically</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="availableLoan">Available Loan (₹)</Label>
              <Input
                id="availableLoan"
                type="number"
                value={availableLoan}
                onChange={(e) => setAvailableLoan(e.target.value)}
                placeholder="400000"
              />
            </div>
          </div>

          {/* Optional Filters */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-medium">Optional Filters</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="filterPeriod">Filter by Period</Label>
                <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                  <SelectTrigger id="filterPeriod">
                    <SelectValue placeholder="All periods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    {periods.map((period) => (
                      <SelectItem key={period} value={period}>
                        {period}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filterStatus">Filter by Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger id="filterStatus">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="finalized">Finalized</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-between border-t pt-4">
            <div>
              {updatedCount !== null && (
                <p className="text-sm text-muted-foreground">
                  Last update: <span className="font-semibold text-foreground">{updatedCount}</span> record(s) updated
                </p>
              )}
            </div>
            <Button onClick={handleApplyToAll} disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Apply to All"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
