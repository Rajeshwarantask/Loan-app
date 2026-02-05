import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    const supabase = await createClient()

    // Remove push subscription from database
    const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", userId)

    if (error) {
      console.error("[API] Push unsubscribe error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update user notification preferences
    await supabase
      .from("profiles")
      .update({
        notifications_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    console.log("[API] Push subscription removed for user:", userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API] Push unsubscribe error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
