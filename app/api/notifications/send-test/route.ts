import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] [Test Send] Endpoint called")

    const { userId } = await request.json()
    console.log("[v0] [Test Send] User ID:", userId)

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    // Get user subscriptions
    const supabase = await createClient()
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("enabled", true)

    console.log("[v0] [Test Send] Found subscriptions:", subscriptions?.length || 0)
    console.log("[v0] [Test Send] Fetch error:", error)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ error: "No subscriptions found", subscriptions: 0 }, { status: 200 })
    }

    // Log subscription details
    subscriptions.forEach((sub, i) => {
      console.log(`[v0] [Test Send] Subscription ${i + 1}:`, {
        id: sub.id,
        endpoint: sub.subscription?.endpoint?.substring(0, 60),
        hasKeys: !!sub.subscription?.keys,
        hasAuth: !!sub.subscription?.keys?.auth,
        hasP256dh: !!sub.subscription?.keys?.p256dh,
      })
    })

    // Check VAPID keys
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY

    console.log("[v0] [Test Send] VAPID keys configured:", {
      public: !!publicKey,
      private: !!privateKey,
    })

    if (!publicKey || !privateKey) {
      return NextResponse.json(
        { error: "VAPID keys not configured", subscriptions: subscriptions.length },
        { status: 500 }
      )
    }

    // Import and configure web-push
    const webpush = await import("web-push")
    webpush.default.setVapidDetails("mailto:admin@vizhuthugal.com", publicKey, privateKey)

    console.log("[v0] [Test Send] Sending notifications...")

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub, index) => {
        try {
          const subscription = sub.subscription as any
          console.log(`[v0] [Test Send] Sending to subscription ${index + 1}...`)

          const result = await webpush.default.sendNotification(
            subscription,
            JSON.stringify({
              title: "Test Notification",
              body: "This is a test notification from Vizhuthugal Sangam",
              icon: "/icon-192.png",
              badge: "/notification-badge.png",
              tag: "test-notification",
              data: { type: "test", timestamp: Date.now() },
            })
          )

          console.log(`[v0] [Test Send] Sent to subscription ${index + 1}:`, result.statusCode)
          return { success: true, statusCode: result.statusCode }
        } catch (error) {
          console.error(`[v0] [Test Send] Failed to send to subscription ${index + 1}:`, error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      })
    )

    const successful = results.filter((r) => r.status === "fulfilled" && r.value.success).length

    console.log(`[v0] [Test Send] Results: ${successful}/${subscriptions.length} successful`)
    console.log("[v0] [Test Send] Detailed results:", JSON.stringify(results, null, 2))

    return NextResponse.json({
      success: true,
      total: subscriptions.length,
      sent: successful,
      results: results.map((r) => (r.status === "fulfilled" ? r.value : { success: false, error: r.reason })),
    })
  } catch (error) {
    console.error("[v0] [Test Send] Error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
