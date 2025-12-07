"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useState } from "react"

export function MonthlyReportDownload() {
  const [loading, setLoading] = useState(false)

  const downloadMonthlyReport = async () => {
    setLoading(true)
    try {
      const supabase = createBrowserClient()

      // Get current month start and end dates
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

      const monthName = monthStart.toLocaleString("default", { month: "long", year: "numeric" })

      // Fetch all loans
      const { data: loans } = await supabase
        .from("loans")
        .select("*, profiles!loans_user_id_fkey(full_name, email)")
        .order("created_at", { ascending: false })

      // Fetch all payments for the current month
      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .gte("payment_date", monthStart.toISOString())
        .lte("payment_date", monthEnd.toISOString())

      // Create CSV content
      let csvContent = `Monthly Loan Report - ${monthName}\n\n`
      csvContent +=
        "User Name,Email,Loan Amount,Balance,Interest Rate,Status,Interest Paid This Month,Principal Paid This Month,Payment Date\n"

      loans?.forEach((loan) => {
        const userPayments = payments?.filter((p) => p.loan_id === loan.id) || []
        const interestPaid = userPayments.reduce((sum, p) => sum + (p.interest_paid || 0), 0)
        const principalPaid = userPayments.reduce((sum, p) => sum + (p.principal_paid || 0), 0)

        const lastPaymentDate =
          userPayments.length > 0
            ? new Date(userPayments[userPayments.length - 1].payment_date).toLocaleDateString()
            : "No payment"

        csvContent += `"${loan.profiles?.full_name || "Unknown"}","${loan.profiles?.email || ""}",₹${loan.amount},₹${loan.balance},${loan.interest_rate}%,${loan.status},₹${interestPaid},₹${principalPaid},${lastPaymentDate}\n`
      })

      // Add summary section
      const totalLoans = loans?.reduce((sum, l) => sum + l.amount, 0) || 0
      const totalBalance = loans?.reduce((sum, l) => sum + l.balance, 0) || 0
      const totalInterestThisMonth = payments?.reduce((sum, p) => sum + (p.interest_paid || 0), 0) || 0
      const totalPrincipalThisMonth = payments?.reduce((sum, p) => sum + (p.principal_paid || 0), 0) || 0

      csvContent += `\n\nSummary\n`
      csvContent += `Total Loans Issued,₹${totalLoans}\n`
      csvContent += `Total Outstanding Balance,₹${totalBalance}\n`
      csvContent += `Total Interest Collected This Month,₹${totalInterestThisMonth}\n`
      csvContent += `Total Principal Collected This Month,₹${totalPrincipalThisMonth}\n`

      // Download the CSV file
      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Monthly_Loan_Report_${monthName.replace(" ", "_")}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error generating report:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={downloadMonthlyReport} disabled={loading} variant="outline">
      <Download className="mr-2 h-4 w-4" />
      {loading ? "Generating..." : "Monthly Report"}
    </Button>
  )
}
