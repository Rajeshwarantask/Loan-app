import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { NextRequest, NextResponse } from "next/server"

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

export async function POST(request: NextRequest) {
  try {
    const profile = await requireAdmin()
    const { data, currentPeriodKey, prevPeriodKey } = await request.json()

    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 })
    }

    // Generate CSV content
    const csvHeaders = [
      "Member ID",
      "Member Name",
      "Loan Amount",
      "EMI",
      "Interest",
      "Subscription",
      "Remaining Loan",
      "Total Amount",
    ]

    const csvRows = data.map((row: PredictionBillRow) => [
      row.member_id,
      row.full_name,
      row.loan_amount.toString(),
      row.emi.toString(),
      row.interest.toString(),
      row.subscription.toString(),
      row.remaining.toString(),
      row.total.toString(),
    ])

    // Calculate totals
    const totals = [
      "TOTAL",
      "",
      data.reduce((sum: number, row: PredictionBillRow) => sum + row.loan_amount, 0).toString(),
      data.reduce((sum: number, row: PredictionBillRow) => sum + row.emi, 0).toString(),
      data.reduce((sum: number, row: PredictionBillRow) => sum + row.interest, 0).toString(),
      data.reduce((sum: number, row: PredictionBillRow) => sum + row.subscription, 0).toString(),
      data.reduce((sum: number, row: PredictionBillRow) => sum + row.remaining, 0).toString(),
      data.reduce((sum: number, row: PredictionBillRow) => sum + row.total, 0).toString(),
    ]

    // Build CSV
    let csv = csvHeaders.join(",") + "\n"
    csv += csvRows.map((row: string[]) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
    csv += "\n" + totals.map((cell) => `"${cell}"`).join(",")

    // Add metadata
    csv += "\n\n"
    csv += `"Prediction Bill for Period: ${currentPeriodKey}"\n`
    csv += `"Based on previous month data: ${prevPeriodKey}"\n`
    csv += `"Generated on: ${new Date().toISOString().split("T")[0]}"\n`
    csv += `"EMI Rule: EMI included only if Loan Amount > ₹1,00,000"\n`

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="prediction-bill-${currentPeriodKey}.csv"`,
      },
    })
  } catch (error) {
    console.error("[v0] Error generating prediction bill:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate prediction bill" },
      { status: 500 }
    )
  }
}
