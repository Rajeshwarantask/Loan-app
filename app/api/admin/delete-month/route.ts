import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

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

    console.log("[v0] DELETE month request - periodKey:", periodKey, "isCurrentMonth:", isCurrentMonth)

    if (isCurrentMonth) {
      // Delete from monthly_loan_records (current month)
      const { error: deleteError, count } = await supabase
        .from("monthly_loan_records")
        .delete()
        .eq("period_key", periodKey)

      if (deleteError) {
        console.error("[v0] Error deleting current month data:", deleteError)
        throw deleteError
      }

      console.log("[v0] Deleted", count, "records from monthly_loan_records for", periodKey)

      return NextResponse.json({
        success: true,
        message: `Deleted ${count} records from current month (${periodKey})`,
        recordsDeleted: count,
      })
    } else {
      // Delete from monthly_loan_records_history (past month)
      const { error: deleteError, count } = await supabase
        .from("monthly_loan_records_history")
        .delete()
        .eq("period_key", periodKey)

      if (deleteError) {
        console.error("[v0] Error deleting history data:", deleteError)
        throw deleteError
      }

      console.log("[v0] Deleted", count, "records from monthly_loan_records_history for", periodKey)

      return NextResponse.json({
        success: true,
        message: `Deleted ${count} records from history (${periodKey})`,
        recordsDeleted: count,
      })
    }
  } catch (error) {
    console.error("[v0] Error in DELETE /api/admin/delete-month:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete month data" },
      { status: 500 },
    )
  }
}
