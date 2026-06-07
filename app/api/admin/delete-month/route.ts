import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

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

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "admin")
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })

    const { periodKey } = await request.json()

    if (!periodKey)
      return NextResponse.json({ error: "Period key is required" }, { status: 400 })

    const validation = validatePeriodKey(periodKey)
    if (!validation.valid)
      return NextResponse.json({ error: validation.error }, { status: 400 })

    console.log("[v0] DELETE month snapshot - periodKey:", periodKey)

    // ✅ ONLY delete the monthly snapshot — loan_payments and additional_loan are preserved
    const { count: recordsDeleted, error: recordDeleteError } = await supabase
      .from("monthly_loan_records")
      .delete()
      .eq("period_key", periodKey)
      .select("*", { count: "exact", head: true })

    if (recordDeleteError) {
      console.error("[v0] Error deleting monthly_loan_records:", recordDeleteError)
      throw recordDeleteError
    }

    console.log("[v0] Deleted", recordsDeleted, "records from monthly_loan_records for", periodKey)

    // ✅ Also clear from history if it was archived there
    const { count: historyDeleted, error: historyDeleteError } = await supabase
      .from("monthly_loan_records_history")
      .delete()
      .eq("period_key", periodKey)
      .select("*", { count: "exact", head: true })

    if (historyDeleteError) {
      console.error("[v0] Error deleting monthly_loan_records_history:", historyDeleteError)
      throw historyDeleteError
    }

    console.log("[v0] Deleted", historyDeleted, "records from monthly_loan_records_history for", periodKey)

    return NextResponse.json({
      success: true,
      message: `Reset snapshot for ${periodKey}. Re-initialize to rebuild from payment data.`,
      details: {
        recordsDeleted: recordsDeleted ?? 0,
        historyDeleted: historyDeleted ?? 0,
        totalDeleted: (recordsDeleted ?? 0) + (historyDeleted ?? 0),
      },
    })
  } catch (error) {
    console.error("[v0] Error in DELETE /api/admin/delete-month:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete month data" },
      { status: 500 }
    )
  }
}
