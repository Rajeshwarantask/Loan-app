"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileDown, AlertCircle } from "lucide-react"

interface User {
  id: string
  full_name: string
  member_id: string
}

interface CashBillDownloadClientProps {
  users: User[]
}

export function CashBillDownloadClient({ users }: CashBillDownloadClientProps) {
  const [selectedUser, setSelectedUser] = useState<string>("all")
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string>("")

  const downloadCashBill = async () => {
    setDownloading(true)
    setError("")
    try {
      console.log("[v0] Starting cash bill download for:", selectedUser)
      const response = await fetch("/api/admin/cash-bill-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedUser: selectedUser === "all" ? null : selectedUser,
          month: new Date().toISOString().slice(0, 7),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate cash bill")
      }

      console.log("[v0] Response received, creating blob")
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `cash-bill-${selectedUser === "all" ? "all-users" : selectedUser}-${new Date().toISOString().slice(0, 7)}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      console.log("[v0] Cash bill downloaded successfully")
    } catch (error) {
      console.error("[v0] Error downloading cash bill:", error)
      setError(error instanceof Error ? error.message : "Failed to download cash bill")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Download Cash Bill</CardTitle>
          <CardDescription>Select user(s) to generate cash bill statement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Select User</label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.member_id} - {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Month</label>
            <div className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" })}
            </div>
          </div>

          <Button onClick={downloadCashBill} disabled={downloading} className="w-full">
            <FileDown className="mr-2 h-4 w-4" />
            {downloading ? "Generating..." : "Download Cash Bill (CSV)"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cash Bill Contents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Each cash bill statement includes:</p>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            <li>Member ID and Name</li>
            <li>Subscription Income</li>
            <li>Loan Balance (Principal)</li>
            <li>Monthly Interest</li>
            <li>Updated Principal Balance</li>
            <li>Monthly Installment Amount</li>
            <li>Installment Interest</li>
            <li>Interest Months Remaining</li>
            <li>Total Loan Balance</li>
            <li>Fine (if any)</li>
            <li>Total Amount to be Paid</li>
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
