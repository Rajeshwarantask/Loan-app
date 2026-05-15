import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[TEST] Test notification endpoint called")
    console.log("[TEST] Request URL:", request.url)
    console.log("[TEST] Request headers:", {
      contentType: request.headers.get("content-type"),
    })

    const { userId } = await request.json()
    console.log("[TEST] Received userId:", userId)

    if (!userId) {
      console.error("[TEST] Missing userId")
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get user
    const { data: user, error: userError } = await supabase.from("profiles").select("*").eq("id", userId).single()

    if (userError || !user) {
      console.error("[TEST] User not found:", userError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log("[TEST] User found:", user.email)

    // Get subscriptions for this user
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId)

    console.log("[TEST] Subscriptions for user:", subscriptions?.length || 0)
    console.log("[TEST] Sub error:", subError)

    if (subError) {
      console.error("[TEST] Error fetching subscriptions:", subError)
    }

    if (subscriptions && subscriptions.length > 0) {
      subscriptions.forEach((sub, index) => {
        console.log(`[TEST] Subscription ${index + 1}:`, {
          id: sub.id,
          endpoint: sub.endpoint?.substring(0, 50),
          enabled: sub.enabled,
          hasSubscriptionObject: !!sub.subscription,
          subscriptionKeys: sub.subscription?.keys ? "present" : "missing",
        })
      })
    }

    // Check environment variables
    console.log("[TEST] Environment check:")
    console.log("[TEST] NEXT_PUBLIC_VAPID_PUBLIC_KEY:", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? "SET" : "NOT SET")
    console.log("[TEST] VAPID_PRIVATE_KEY:", process.env.VAPID_PRIVATE_KEY ? "SET" : "NOT SET")

    // Attempt to send test notification - use relative URL
    console.log("[TEST] Attempting to send test notification...")
    
    const sendUrl = new URL("/api/notifications/send", request.nextUrl.origin)
    console.log("[TEST] Send URL:", sendUrl.toString())

    try {
      const sendResponse = await fetch(sendUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          type: "test",
          title: "Test Notification",
          body: "This is a test push notification from Vizhuthugal Sangam",
        }),
      })

      console.log("[TEST] Send response status:", sendResponse.status)

      const sendResult = await sendResponse.json()
      console.log("[TEST] Send response:", sendResult)

      return NextResponse.json({
        success: true,
        user: user.email,
        subscriptions: subscriptions?.length || 0,
        vapidConfigured: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY,
        sendResult,
      })
    } catch (fetchError) {
      console.error("[TEST] Fetch error to /api/notifications/send:", fetchError)
      if (fetchError instanceof Error) {
        console.error("[TEST] Error message:", fetchError.message)
      }

      return NextResponse.json(
        {
          success: true,
          user: user.email,
          subscriptions: subscriptions?.length || 0,
          vapidConfigured: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY,
          sendResult: { error: "Failed to call send endpoint" },
        },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error("[TEST] Test endpoint error:", error)
    if (error instanceof Error) {
      console.error("[TEST] Error message:", error.message)
      console.error("[TEST] Error stack:", error.stack?.split("\n").slice(0, 3).join("\n"))
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
