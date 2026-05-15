"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FileDown, Eye } from "lucide-react"
import { formatCurrency } from "@/lib/utils/loan-calculator"

interface User {
  id: string
  full_name: string
  member_id: string
}

interface PrevMonthPayment {
  user_id: string
  member_id: string
  full_name: string
  loan_id: string
  monthly_subscription: number
  interest_paid: number
  monthly_emi: number
  remaining_balance: number
}

interface ActiveLoan {
  user_id: string
  member_id: string
  full_name: string
  id: string
  loan_amount: number // current outstanding balance (remaining_balance column removed from DB)
  status: string
}

interface PredictionBillRow {
  member_id: string
  full_name: string
  loan_amount: number
  emi: number
  interest: number
  subscription: number
  remaining: number
  total: number
}

interface PredictionBillClientProps {
  users: User[]
  prevMonthPayments: PrevMonthPayment[]
  activeLoans: ActiveLoan[]
  currentPeriodKey: string
  prevPeriodKey: string
}

const EMI_THRESHOLD = 100000 // 1 lakh

export function PredictionBillClient({
  users,
  prevMonthPayments,
  activeLoans,
  currentPeriodKey,
  prevPeriodKey,
}: PredictionBillClientProps) {
  const [downloading, setDownloading] = useState(false)
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const [error, setError] = useState<string>("")

  const downloadBillExcel = async () => {
    setDownloadingExcel(true)
    setError("")
    try {
      const response = await fetch("/api/admin/prediction-bill-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthYear: currentPeriodKey }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate prediction bill")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `prediction-bill-${currentPeriodKey}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error("[v0] Error downloading prediction bill:", err)
      setError(err instanceof Error ? err.message : "Failed to download prediction bill")
    } finally {
      setDownloadingExcel(false)
    }
  }

  // Calculate prediction bill data
  const predictionData: PredictionBillRow[] = useMemo(() => {
    const data = users.map((user) => {
      // Find previous month payment data
      const prevPayment = prevMonthPayments.find((p) => p.user_id === user.id)
      
      // Find active loan
      const activeLoan = activeLoans.find((l) => l.user_id === user.id)

      // Get base values
      const interest = prevPayment?.interest_paid ?? 0
      const subscription = prevPayment?.monthly_subscription ?? 0
      const loanAmount = activeLoan?.loan_amount ?? 0
      const remaining = loanAmount // loan_amount IS the current outstanding balance

      // EMI rule: only include if loan > 1,00,000
      const emi = loanAmount > EMI_THRESHOLD ? (prevPayment?.monthly_emi ?? 0) : 0

      // Total = Subscription + Interest + EMI (if rule applies)
      const total = subscription + interest + emi

      return {
        member_id: user.member_id || "",
        full_name: user.full_name,
        loan_amount: loanAmount,
        emi,
        interest,
        subscription,
        remaining,
        total,
      }
    })

    // Sort by member_id in natural order (V1, V2, V3, ... V44)
    return data.sort((a, b) => {
      const aId = a.member_id || ""
      const bId = b.member_id || ""

      // Extract numeric part from member IDs like "V1", "V10", "V44"
      const aMatch = aId.match(/V[-]?(\d+)/i)
      const bMatch = bId.match(/V[-]?(\d+)/i)

      if (aMatch && bMatch) {
        // Both have numeric parts - compare as numbers
        const aNum = Number.parseInt(aMatch[1], 10)
        const bNum = Number.parseInt(bMatch[1], 10)
        return aNum - bNum
      }

      // Fallback to alphabetical if no numeric part found
      return aId.localeCompare(bId)
    })
  }, [users, prevMonthPayments, activeLoans])

  // Calculate totals
  const totalsSummary = useMemo(() => {
    return {
      loan_amount: predictionData.reduce((sum, row) => sum + row.loan_amount, 0),
      emi: predictionData.reduce((sum, row) => sum + row.emi, 0),
      interest: predictionData.reduce((sum, row) => sum + row.interest, 0),
      subscription: predictionData.reduce((sum, row) => sum + row.subscription, 0),
      remaining: predictionData.reduce((sum, row) => sum + row.remaining, 0),
      total: predictionData.reduce((sum, row) => sum + row.total, 0),
    }
  }, [predictionData])

  const handleDownload = async () => {
    setDownloading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/prediction-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: predictionData,
          currentPeriodKey,
          prevPeriodKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate prediction bill")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `prediction-bill-${currentPeriodKey}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download prediction bill")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Prediction Bill Preview</CardTitle>
            <CardDescription>
              Expected payment for {currentPeriodKey} based on {prevPeriodKey} data
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={downloadBillExcel} disabled={downloadingExcel} className="gap-2">
              <FileDown className="h-4 w-4" />
              {downloadingExcel ? "Generating..." : "Download Bill"}
            </Button>
            <Button onClick={handleDownload} disabled={downloading} variant="outline" className="gap-2">
              <FileDown className="h-4 w-4" />
              {downloading ? "Downloading..." : "Download CSV"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="text-xs md:text-sm">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="whitespace-nowrap px-2 py-2">Member ID</TableHead>
                <TableHead className="whitespace-nowrap px-2 py-2">Member Name</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 py-2">Loan Amount</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 py-2">EMI</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 py-2">Interest</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 py-2">Subscription</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 py-2">Remaining</TableHead>
                <TableHead className="text-right whitespace-nowrap px-2 py-2 font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {predictionData.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-muted/30">
                  <TableCell className="whitespace-nowrap px-2 py-2 font-medium text-xs md:text-sm">
                    {row.member_id}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-2 py-2 text-xs md:text-sm">
                    {row.full_name}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap px-2 py-2 text-xs md:text-sm">
                    {formatCurrency(row.loan_amount)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap px-2 py-2 text-xs md:text-sm">
                    {formatCurrency(row.emi)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap px-2 py-2 text-xs md:text-sm">
                    {formatCurrency(row.interest)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap px-2 py-2 text-xs md:text-sm">
                    {formatCurrency(row.subscription)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap px-2 py-2 text-xs md:text-sm">
                    {formatCurrency(row.remaining)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap px-2 py-2 font-semibold text-xs md:text-sm">
                    {formatCurrency(row.total)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={2} className="px-2 py-2">
                  TOTAL
                </TableCell>
                <TableCell className="text-right whitespace-nowrap px-2 py-2">
                  {formatCurrency(totalsSummary.loan_amount)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap px-2 py-2">
                  {formatCurrency(totalsSummary.emi)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap px-2 py-2">
                  {formatCurrency(totalsSummary.interest)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap px-2 py-2">
                  {formatCurrency(totalsSummary.subscription)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap px-2 py-2">
                  {formatCurrency(totalsSummary.remaining)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap px-2 py-2">
                  {formatCurrency(totalsSummary.total)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>


    </>
  )
}
