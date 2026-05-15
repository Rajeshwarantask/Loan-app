import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

interface PushMessage {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  url?: string
}

interface PushSubscription {
  endpoint: string
  expirationTime: null | number
  keys: {
    p256dh: string
    auth: string
  }
}

// Helper function to send push notification using web-push
async function sendPushNotification(
  subscription: PushSubscription,
  message: PushMessage
): Promise<boolean> {
  try {
    console.log("[Push] Attempting to send notification...")

    // Dynamically import web-push to avoid build issues if not installed
    const webpush = await import("web-push")

    // Check if VAPID keys are configured
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY

    console.log("[Push] VAPID keys check:")
    console.log("[Push] Public key exists:", !!publicKey)
    console.log("[Push] Private key exists:", !!privateKey)

    if (!publicKey || !privateKey) {
      console.error("[Push] VAPID keys not configured!")
      console.error("[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY:", publicKey ? "SET" : "NOT SET")
      console.error("[Push] VAPID_PRIVATE_KEY:", privateKey ? "SET" : "NOT SET")
      return false
    }

    console.log("[Push] Setting VAPID details...")
    webpush.default.setVapidDetails(
      "mailto:admin@vizhuthugal.com",
      publicKey,
      privateKey
    )

    console.log("[Push] Sending notification to endpoint:", subscription.endpoint.substring(0, 50) + "...")
    console.log("[Push] Message:", message)

    // Send the notification - subscription is already JSONB object, no parsing needed
    const sendResult = await webpush.default.sendNotification(
      subscription,
      JSON.stringify({
        title: message.title,
        body: message.body,
        icon: message.icon,
        badge: message.badge,
        tag: message.tag,
        data: message,
      })
    )

    console.log("[Push] Notification sent successfully:", sendResult)
    return true
  } catch (error) {
    console.error("[Push] Error sending push notification:", error)
    if (error instanceof Error) {
      console.error("[Push] Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack?.split("\n").slice(0, 3).join("\n"),
      })
    }
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[API] Send notifications endpoint called")

    // This endpoint should be protected by authentication in production
    const { userId, userIds, type, title, body, data } = await request.json()

    console.log("[API] Request payload:", { userId, userIdCount: userIds?.length, type, title })

    // Accept either userId or userIds
    let targetUserIds: string[] = []
    if (userId) {
      targetUserIds = [userId]
    } else if (userIds && Array.isArray(userIds)) {
      targetUserIds = userIds
    }

    if (targetUserIds.length === 0 || !type) {
      console.error("[API] Missing userId/userIds or type")
      return NextResponse.json({ error: "Missing userId/userIds or type" }, { status: 400 })
    }

    const supabase = await createClient()

    console.log("[API] Fetching subscriptions for users:", targetUserIds.length)

    // Get push subscriptions for the specified users
    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .in("user_id", targetUserIds)
      .eq("enabled", true)

    console.log("[API] Subscriptions found:", subscriptions?.length || 0)
    console.log("[API] Fetch error:", fetchError)

    if (fetchError) {
      console.error("[API] Error fetching subscriptions:", fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("[API] No active subscriptions for users:", targetUserIds)
      return NextResponse.json({ message: "No active subscriptions", sent: 0 }, { status: 200 })
    }

    // Send notifications to all subscriptions
    const message: PushMessage = {
      title: title || "Vizhuthugal Sangam",
      body: body || "You have a new notification",
      icon: "/icon-192.png",
      badge: "/notification-badge.png",
      tag: `notification-${type}`,
      ...data,
    }

    console.log("[API] Sending message:", message)
    console.log(`[API] Attempting to send to ${subscriptions.length} subscription(s)`)

    const results = await Promise.all(
      subscriptions.map((sub, index) => {
        console.log(`[API] Processing subscription ${index + 1}/${subscriptions.length}`)
        // subscription is already a JSONB object from Supabase, no need to parse
        const subscription = sub.subscription as PushSubscription
        console.log(`[API] Subscription details:`, {
          endpoint: subscription?.endpoint?.substring(0, 50),
          hasKeys: !!subscription?.keys,
          hasAuth: !!subscription?.keys?.auth,
          hasP256dh: !!subscription?.keys?.p256dh,
        })
        return sendPushNotification(subscription, message).catch((err) => {
          console.error("[API] Failed to send to subscription:", err)
          return false
        })
      })
    )

    const successCount = results.filter(Boolean).length

    console.log(`[API] Successfully sent notifications to ${successCount}/${subscriptions.length} users`)
    return NextResponse.json({ success: true, sent: successCount, total: subscriptions.length })
  } catch (error) {
    console.error("[API] Error sending notifications:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
