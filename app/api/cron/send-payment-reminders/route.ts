import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    // Verify the cron secret if configured
    const cronSecret = request.headers.get("x-cron-secret")
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const dayOfMonth = now.getDate()

    // Send reminders 2 days before month end
    if (dayOfMonth !== daysInMonth - 2) {
      return NextResponse.json({ message: "Not a reminder day", day: dayOfMonth, reminderDay: daysInMonth - 2 }, { status: 200 })
    }

    console.log("[Cron] Starting payment reminder check for", dayOfMonth, "of", daysInMonth)

    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    // Get all users with unpaid EMIs in current month
    const { data: unpaidRecords, error: fetchError } = await supabase
      .from("monthly_loan_records")
      .select(
        `
        user_id,
        monthly_subscription,
        profiles:user_id(id, full_name)
      `
      )
      .eq("period_key", currentMonthKey)
      .eq("payment_status", "pending")

    if (fetchError) {
      console.error("[Cron] Error fetching unpaid records:", fetchError)
      return NextResponse.json({ error: "Failed to fetch unpaid records" }, { status: 500 })
    }

    if (!unpaidRecords || unpaidRecords.length === 0) {
      return NextResponse.json({ message: "No unpaid records found", count: 0 }, { status: 200 })
    }

    // Send reminders to each user via API
    const userIds = unpaidRecords.map((record: any) => record.user_id)
    
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/notifications/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "payment_reminder",
        userIds: userIds,
        title: "Payment Reminder",
        body: "Your EMI payment is due in 2 days. Please make your payment before the month ends.",
        data: { type: "payment_reminder", daysUntilDue: 2 },
      }),
    }).catch((error) => {
      console.error("[Cron] Failed to send payment reminders via API:", error)
    })

    const successCount = unpaidRecords.length

    console.log("[Cron] Payment reminders sent to", successCount, "out of", unpaidRecords.length, "users")

    return NextResponse.json(
      {
        message: "Payment reminders sent successfully",
        totalUsers: unpaidRecords.length,
        successCount,
        reminderDate: `${dayOfMonth} of ${daysInMonth}`,
        period: currentMonthKey,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[Cron] Error in payment reminder cron:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Also support POST for testing
export async function POST(request: NextRequest) {
  return GET(request)
}
