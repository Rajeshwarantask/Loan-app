"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import * as XLSX from "xlsx"

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
  period_key: string
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

interface DownloadMonthlyReportButtonProps {
  monthYear: string
  records: MonthlyRecord[]
}

export function DownloadMonthlyReportButton({ monthYear, records }: DownloadMonthlyReportButtonProps) {
  const handleDownload = () => {
    // Sort records by member_id
    const sortedRecords = [...records]
      .filter((record) => record.profiles && record.profiles.member_id)
      .sort((a, b) => {
        const aId = a.profiles?.member_id || ""
        const bId = b.profiles?.member_id || ""
        return aId.localeCompare(bId, undefined, { numeric: true })
      })

    // Calculate totals
    const totals = {
      totalSubscription: records.reduce((sum, r) => sum + (r.monthly_subscription ?? 0), 0),
      totalInterest: records.reduce((sum, r) => sum + (r.monthly_interest_income ?? 0), 0),
      totalPrincipal: records.reduce((sum, r) => sum + (r.additional_principal ?? 0), 0),
      totalInstallment: records.reduce((sum, r) => sum + (r.monthly_installment_income ?? 0), 0),
      totalNewLoans: records.reduce((sum, r) => sum + (r.new_loan_taken ?? 0), 0),
      totalPenalty: records.reduce((sum, r) => sum + (r.penalty ?? 0), 0),
      totalIncome: records.reduce((sum, r) => sum + (r.total_income_current_month ?? 0), 0),
      totalOutstanding: records.reduce((sum, r) => sum + (r.total_loan_outstanding ?? 0), 0),
      totalPreviousIncome: records.reduce((sum, r) => sum + (r.previous_month_total_income ?? 0), 0),
      totalDifference: records.reduce((sum, r) => sum + (r.difference ?? 0), 0),
      totalOpeningBalance: records.reduce((sum, r) => sum + (r.previous_month_total_loan_outstanding ?? 0), 0),
      totalAvailableLoan: records.reduce((sum, r) => sum + (r.available_loan_amount ?? 0), 0),
    }

    // Prepare data for Excel
    const data = sortedRecords.map((record) => ({
      "V ID": record.profiles?.member_id || "N/A",
      Name: record.profiles?.full_name || "Unknown",
      "Opening Balance": record.previous_month_total_loan_outstanding,
      "Additional Principal": record.additional_principal,
      "New Loans Issued": record.new_loan_taken,
      "Total Loan Outstanding": record.total_loan_outstanding,
      "Monthly Interest Income": record.monthly_interest_income,
      "Monthly Installment Income": record.monthly_installment_income,
      "Penalty Income": record.penalty,
      "Total Income (Current Month)": record.total_income_current_month,
      "Previous Month Total Income": record.previous_month_total_income,
      Difference: record.difference,
      "Previous Month Total Loan Outstanding": record.previous_month_total_loan_outstanding,
      "Available Loan": record.available_loan_amount,
      Status: record.status === "finalized" ? "Finalized" : "Draft",
    }))

    // Add totals row
    data.push({
      "V ID": "TOTAL",
      Name: "",
      "Opening Balance": totals.totalOpeningBalance,
      "Additional Principal": totals.totalPrincipal,
      "New Loans Issued": totals.totalNewLoans,
      "Total Loan Outstanding": totals.totalOutstanding,
      "Monthly Interest Income": totals.totalInterest,
      "Monthly Installment Income": totals.totalInstallment,
      "Penalty Income": totals.totalPenalty,
      "Total Income (Current Month)": totals.totalIncome,
      "Previous Month Total Income": totals.totalPreviousIncome,
      Difference: totals.totalDifference,
      "Previous Month Total Loan Outstanding": totals.totalOpeningBalance,
      "Available Loan": totals.totalAvailableLoan,
      Status: "",
    })

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(data)

    // Set column widths
    ws["!cols"] = [
      { wch: 8 }, // V ID
      { wch: 20 }, // Name
      { wch: 15 }, // Opening Balance
      { wch: 18 }, // Additional Principal
      { wch: 18 }, // New Loans Issued
      { wch: 20 }, // Total Loan Outstanding
      { wch: 20 }, // Monthly Interest Income
      { wch: 22 }, // Monthly Installment Income
      { wch: 15 }, // Penalty Income
      { wch: 22 }, // Total Income (Current Month)
      { wch: 25 }, // Previous Month Total Income
      { wch: 12 }, // Difference
      { wch: 30 }, // Previous Month Total Loan Outstanding
      { wch: 15 }, // Available Loan
      { wch: 12 }, // Status
    ]

    // Create workbook
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Monthly Report")

    // Generate filename
    const filename = `Monthly_Report_${monthYear}.xlsx`

    // Generate binary string
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })

    // Create blob and trigger download
    const blob = new Blob([wbout], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" onClick={handleDownload}>
      <Download className="h-4 w-4 mr-2" />
      Download XLSX
    </Button>
  )
}
