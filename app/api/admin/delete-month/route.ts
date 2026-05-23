import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Validate period key format (YYYY-MM)
function validatePeriodKey(periodKey: string): { valid: boolean; error?: string } {
  const periodPattern = /^\d{4}-\d{2}$/
  if (!periodPattern.test(periodKey)) {
    return { valid: false, error: "Invalid period key format. Expected YYYY-MM" }
  }

  const [yearStr, monthStr] = periodKey.split("-")
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)

  if (month < 1 || month > 12) {
    return { valid: false, error: "Invalid month. Must be between 01 and 12" }
  }

  if (year < 2000 || year > 2100) {
    return { valid: false, error: "Invalid year. Must be between 2000 and 2100" }
  }

  return { valid: true }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    const { periodKey, isCurrentMonth } = await request.json()

    if (!periodKey) {
      return NextResponse.json({ error: "Period key is required" }, { status: 400 })
    }

    // Validate period key format
    const validation = validatePeriodKey(periodKey)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    console.log("[v0] DELETE month request - periodKey:", periodKey, "isCurrentMonth:", isCurrentMonth)

    // Delete all related data for this period (both current and backfill)
    // 1. Delete from loan_payments
    const { count: paymentsDeleted, error: paymentDeleteError } = await supabase
      .from("loan_payments")
      .delete()
      .eq("period_key", periodKey)

    if (paymentDeleteError) {
      console.error("[v0] Error deleting loan_payments:", paymentDeleteError)
      throw paymentDeleteError
    }

    console.log("[v0] Deleted", paymentsDeleted, "records from loan_payments for", periodKey)

    // 2. Delete from additional_loan
    const { count: loansDeleted, error: loanDeleteError } = await supabase
      .from("additional_loan")
      .delete()
      .eq("period_key", periodKey)

    if (loanDeleteError) {
      console.error("[v0] Error deleting additional_loan:", loanDeleteError)
      throw loanDeleteError
    }

    console.log("[v0] Deleted", loansDeleted, "records from additional_loan for", periodKey)

    // 3. Delete from monthly_loan_records (current month)
    const { count: recordsDeleted, error: recordDeleteError } = await supabase
      .from("monthly_loan_records")
      .delete()
      .eq("period_key", periodKey)

    if (recordDeleteError) {
      console.error("[v0] Error deleting monthly_loan_records:", recordDeleteError)
      throw recordDeleteError
    }

    console.log("[v0] Deleted", recordsDeleted, "records from monthly_loan_records for", periodKey)

    // 4. Delete from monthly_loan_records_history (past month)
    const { count: historyDeleted, error: historyDeleteError } = await supabase
      .from("monthly_loan_records_history")
      .delete()
      .eq("period_key", periodKey)

    if (historyDeleteError) {
      console.error("[v0] Error deleting monthly_loan_records_history:", historyDeleteError)
      throw historyDeleteError
    }

    console.log("[v0] Deleted", historyDeleted, "records from monthly_loan_records_history for", periodKey)

    const totalDeleted = (paymentsDeleted || 0) + (loansDeleted || 0) + (recordsDeleted || 0) + (historyDeleted || 0)

    return NextResponse.json({
      success: true,
      message: `Deleted all data for ${periodKey} (${totalDeleted} total records)`,
      details: {
        paymentsDeleted,
        loansDeleted,
        recordsDeleted,
        historyDeleted,
        totalDeleted,
      },
    })
  } catch (error) {
    console.error("[v0] Error in DELETE /api/admin/delete-month:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete month data" },
      { status: 500 },
    )
  }
}
