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

// Helper function to send push notification (requires web-push library in production)
async function sendPushNotification(endpoint: string, message: PushMessage): Promise<boolean> {
  try {
    // In production, use web-push library to send notifications
    // const webpush = require('web-push');
    // await webpush.sendNotification(subscription, JSON.stringify(message));

    // For now, just log the notification
    console.log("[API] Sending push notification to:", endpoint, message)
    return true
  } catch (error) {
    console.error("[API] Error sending push notification:", error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // This endpoint should be protected by authentication in production
    const { userId, type, title, body, data } = await request.json()

    if (!userId || !type) {
      return NextResponse.json({ error: "Missing userId or type" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get push subscriptions for the user
    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("enabled", true)

    if (fetchError) {
      console.error("[API] Error fetching subscriptions:", fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: "No active subscriptions" }, { status: 200 })
    }

    // Send notifications to all subscriptions
    const message: PushMessage = {
      title: title || "Vizhuthugal Sangam",
      body: body || "You have a new notification",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: `notification-${type}`,
      ...data,
    }

    const results = await Promise.all(
      subscriptions.map((sub) =>
        sendPushNotification(sub.endpoint, message).catch((err) => {
          console.error("[API] Failed to send to subscription:", err)
          return false
        })
      )
    )

    const successCount = results.filter(Boolean).length

    console.log(`[API] Sent notifications to ${successCount}/${subscriptions.length} users`)
    return NextResponse.json({ success: true, sent: successCount, total: subscriptions.length })
  } catch (error) {
    console.error("[API] Error sending notifications:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
