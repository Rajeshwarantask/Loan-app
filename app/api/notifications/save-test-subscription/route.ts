import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[API] Save test subscription endpoint called")

    const { userId, subscription } = await request.json()

    console.log("[API] Received userId:", userId)
    console.log("[API] Received subscription:", subscription ? "present" : "null")

    if (!subscription || !userId) {
      return NextResponse.json({ error: "Missing subscription or userId" }, { status: 400 })
    }

    if (!subscription.endpoint || !subscription.keys) {
      console.error("[API] Invalid subscription:", {
        hasEndpoint: !!subscription.endpoint,
        hasKeys: !!subscription.keys,
      })
      return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 })
    }

    console.log("[API] Subscription endpoint:", subscription.endpoint.substring(0, 50))
    console.log("[API] Subscription keys:", subscription.keys)

    const supabase = await createClient()

    // Check existing
    const { data: existing, error: existError } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()

    let result
    if (existing) {
      console.log("[API] Updating existing subscription")
      result = await supabase
        .from("push_subscriptions")
        .update({
          subscription,
          endpoint: subscription.endpoint,
          enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select()
    } else {
      console.log("[API] Inserting new subscription")
      result = await supabase
        .from("push_subscriptions")
        .insert({
          user_id: userId,
          subscription,
          endpoint: subscription.endpoint,
          enabled: true,
          updated_at: new Date().toISOString(),
        })
        .select()
    }

    if (result.error) {
      console.error("[API] Supabase error:", result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    console.log("[API] Subscription saved successfully:", result.data)

    return NextResponse.json({
      success: true,
      data: result.data,
      message: "Subscription saved",
    })
  } catch (error) {
    console.error("[API] Error:", error)
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
