import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { subscription, userId } = await request.json()

    if (!subscription || !userId) {
      return NextResponse.json({ error: "Missing subscription or userId" }, { status: 400 })
    }

    const supabase = await createClient()

    // Save push subscription to database
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        subscription: JSON.stringify(subscription),
        endpoint: subscription.endpoint,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    )

    if (error) {
      console.error("[API] Push subscription error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update user notification preferences
    await supabase
      .from("profiles")
      .update({
        notifications_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    console.log("[API] Push subscription saved for user:", userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API] Push subscription error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
