import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { monthlySubscription, availableLoanAmount, periodKey, status } = body

    // Validate inputs
    if (typeof monthlySubscription !== "number" || typeof availableLoanAmount !== "number") {
      return NextResponse.json(
        { error: "Invalid input: monthlySubscription and availableLoanAmount must be numbers" },
        { status: 400 },
      )
    }

    console.log("[v0] Bulk update request:", { monthlySubscription, availableLoanAmount, periodKey, status })

    // Build the update query
    let query = supabase.from("monthly_loan_records").update({
      monthly_subscription: monthlySubscription,
      available_loan_amount: availableLoanAmount,
    })

    if (periodKey) {
      query = query.eq("period_key", periodKey)
    } else if (status) {
      query = query.eq("status", status)
    } else {
      // When no filters specified, use a condition that matches all records
      query = query.neq("id", "00000000-0000-0000-0000-000000000000")
    }

    // Add select to return updated records
    query = query.select()

    // Execute the bulk update
    const { data, error } = await query

    if (error) {
      console.error("[v0] Bulk update error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[v0] Bulk update success:", { data })

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      message: `Successfully updated ${data?.length || 0} record(s)`,
    })
  } catch (error) {
    console.error("[v0] Bulk update error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
