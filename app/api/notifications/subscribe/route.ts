import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[API] Subscribe endpoint called")
    console.log("[API] Request method:", request.method)
    console.log("[API] Request URL:", request.url)
    console.log("[API] Request headers:", {
      contentType: request.headers.get("content-type"),
    })

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("[API] Failed to parse request body:", parseError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { subscription, userId } = body

    console.log("[API] Received userId:", userId)
    console.log("[API] Received subscription:", subscription ? "object" : "null")

    if (!subscription || !userId) {
      console.error("[API] Missing subscription or userId")
      
      // FALLBACK: Allow enabling notifications even without a valid push subscription
      // This allows users to opt-in to notifications in the app
      if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 })
      }
      
      console.log("[API] No push subscription provided, but creating database opt-in for user:", userId)
      
      // Save user preference to enable notifications even without push subscription
      const supabase = await createClient()
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          notifications_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
      
      if (profileError) {
        console.error("[API] Error updating profile:", profileError)
        return NextResponse.json({ error: "Failed to save preference" }, { status: 500 })
      }
      
      console.log("[API] User opted in to notifications (without push subscription)")
      return NextResponse.json({ 
        success: true, 
        message: "Notifications enabled (in-app only)",
        fallback: true 
      })
    }

    // Validate subscription object has required fields
    if (!subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      console.error("[API] Invalid subscription object structure:", {
        hasEndpoint: !!subscription.endpoint,
        hasKeys: !!subscription.keys,
        hasP256dh: !!subscription.keys?.p256dh,
        hasAuth: !!subscription.keys?.auth,
      })
      return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 })
    }

    console.log("[API] Validation passed, creating Supabase client...")
    const supabase = await createClient()
    console.log("[API] Supabase client created")

    console.log("[API] Saving subscription to database...")
    console.log("[API] Subscription endpoint:", subscription.endpoint)

    // First, try to get existing subscription
    const { data: existing, error: existError } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .single()

    console.log("[API] Existing subscription check - error:", existError?.message || "none")
    console.log("[API] Existing subscription found:", !!existing)

    let data: any
    let error: any

    if (existing) {
      // Update existing subscription
      console.log("[API] Updating existing subscription...")
      const result = await supabase
        .from("push_subscriptions")
        .update({
          subscription: subscription,
          endpoint: subscription.endpoint,
          enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select()

      data = result.data
      error = result.error
      console.log("[API] Updated existing subscription, error:", error?.message || "none")
    } else {
      // Insert new subscription
      console.log("[API] Inserting new subscription...")
      const result = await supabase
        .from("push_subscriptions")
        .insert({
          user_id: userId,
          subscription: subscription,
          endpoint: subscription.endpoint,
          enabled: true,
          updated_at: new Date().toISOString(),
        })
        .select()

      data = result.data
      error = result.error
      console.log("[API] Inserted new subscription, error:", error?.message || "none")
    }

    if (error) {
      console.error("[API] Supabase error saving subscription:", error)
      console.error("[API] Error details:", {
        message: error.message,
        code: error.code,
        hint: error.hint,
      })
      return NextResponse.json({ error: error.message || "Failed to save subscription" }, { status: 500 })
    }

    console.log("[API] Subscription saved to database:", data)

    // Update user notification preferences
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        notifications_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (profileError) {
      console.error("[API] Error updating profile:", profileError)
    } else {
      console.log("[API] User profile updated with notifications_enabled = true")
    }

    console.log("[API] Push subscription saved successfully for user:", userId)
    return NextResponse.json({ success: true, message: "Subscription saved" })
  } catch (error) {
    console.error("[API] Push subscription error:", error)
    const errorDetails = error instanceof Error ? error.message : JSON.stringify(error)
    console.error("[API] Full error:", errorDetails)
    return NextResponse.json({ error: "Internal server error: " + errorDetails }, { status: 500 })
  }
}
